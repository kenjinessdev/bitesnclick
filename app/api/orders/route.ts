import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeText } from "@/lib/utils/sanitize";

const ALLOWED_PAYMENT_METHODS = ["Cash On Delivery", "GCASH"] as const;

class OrderApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "OrderApiError";
        this.status = status;
    }
}

function assertCartId(cartId: unknown) {
    if (typeof cartId !== "string" || !cartId.trim()) {
        throw new OrderApiError(400, "Missing cartId");
    }

    return cartId;
}

function assertPaymentMethod(paymentMethod: unknown) {
    if (
        typeof paymentMethod !== "string" ||
        !ALLOWED_PAYMENT_METHODS.includes(
            paymentMethod as (typeof ALLOWED_PAYMENT_METHODS)[number],
        )
    ) {
        throw new OrderApiError(400, "Invalid payment method");
    }

    return paymentMethod;
}

function sanitizeOrderText(value: unknown, maxLength: number) {
    return safeText(value).slice(0, maxLength);
}

async function requireUser(supabase: any) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        throw new OrderApiError(401, "Not authenticated");
    }

    return user;
}

async function validateVoucher(supabase: any, voucherCode: string | null) {
    if (!voucherCode) return null;

    const { data: voucherData, error: voucherError } = await supabase
        .from("vouchers")
        .select("voucherid, status, start_date, end_date, percent")
        .eq("code", voucherCode)
        .single();

    if (voucherError || !voucherData) return null;

    const now = new Date();
    const startDate = new Date(voucherData.start_date);
    const expiryDate = new Date(voucherData.end_date);

    if (
        now < startDate ||
        expiryDate < now ||
        voucherData.status !== "available"
    )
        return null;
    return voucherData;
}

async function fetchCartItems(supabase: any, cartId: string, userId: string) {
    // Verify cart ownership first
    const { data: cartData, error: cartError } = await supabase
        .from("cart")
        .select("cartid")
        .eq("cartid", cartId)
        .eq("customerid", userId)
        .single();

    if (cartError || !cartData) {
        throw new OrderApiError(403, "Not authorized for this cart");
    }

    const { data: cartItems, error: cartItemsError } = await supabase
        .from("cart_items")
        .select("*, product:productid(price)")
        .eq("cartid", cartId);

    if (cartItemsError) {
        throw new OrderApiError(500, "Failed to fetch cart items");
    }

    if (!cartItems || cartItems.length === 0) {
        throw new OrderApiError(400, "Cart is empty");
    }

    return cartItems;
}

async function getVoucherDiscount(supabase: any, voucherId: number | null) {
    if (!voucherId) return 0;

    const { data: voucher } = await supabase
        .from("vouchers")
        .select("percent")
        .eq("voucherid", voucherId)
        .single();
    return voucher?.percent ?? 0;
}

async function calculateFinalPrice(
    supabase: any,
    cartItems: any[],
    voucherId: number | null,
) {
    const subtotal = cartItems.reduce(
        (sum: number, item: any) => sum + (item.total_price || 0),
        0,
    );
    const deliveryFee = subtotal === 0 ? 0 : 40;
    let finalPrice = subtotal + deliveryFee;

    const voucherPercent = await getVoucherDiscount(supabase, voucherId);
    const discountAmount = (finalPrice * voucherPercent) / 100;

    return finalPrice - discountAmount;
}

async function insertOrder(supabase: any, orderData: Record<string, unknown>) {
    const { data: orderInsertData, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select("orderid")
        .single();

    if (orderError || !orderInsertData) {
        throw new OrderApiError(500, "Failed to insert order");
    }

    return orderInsertData.orderid;
}

async function buildOrderDetails(
    supabase: any,
    cartItems: any[],
    orderId: number,
) {
    const orderDetailsData: any[] = [];

    for (const item of cartItems) {
        const { data: discountData } = await supabase
            .from("discount")
            .select("newprice")
            .eq("productid", item.productid)
            .lte("start_date", new Date().toISOString())
            .gte("end_date", new Date().toISOString())
            .single();

        const prodPrice = discountData?.newprice ?? item.product?.price ?? 0;
        orderDetailsData.push({
            orderid: orderId,
            productid: item.productid,
            price: item.total_price,
            quantity: item.quantity,
            prod_price: prodPrice,
        });
    }
    return orderDetailsData;
}

async function persistOrderSideEffects(
    supabase: any,
    cartId: string,
    cartItems: any[],
    orderId: number,
    voucherId: number | null,
) {
    const orderDetailsData = await buildOrderDetails(
        supabase,
        cartItems,
        orderId,
    );

    if (orderDetailsData.length > 0) {
        const { error: orderDetailsError } = await supabase
            .from("orderdetails")
            .insert(orderDetailsData);

        if (orderDetailsError) {
            throw new OrderApiError(500, "Failed to insert order details");
        }
    }

    const { error: deleteCartItemsError } = await supabase
        .from("cart_items")
        .delete()
        .eq("cartid", cartId);

    if (deleteCartItemsError) {
        throw new OrderApiError(500, "Failed to clear cart");
    }

    if (voucherId) {
        await supabase
            .from("vouchers")
            .update({ status: "used" })
            .eq("voucherid", voucherId);
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            cartId,
            message,
            address,
            paymentMethod,
            payment_img,
            voucherCode,
        } = body;

        const validCartId = assertCartId(cartId);
        const validPaymentMethod = assertPaymentMethod(paymentMethod);

        const supabase = await createClient();
        const user = await requireUser(supabase);
        const safeMessage = sanitizeOrderText(message, 500);
        const safeAddress = sanitizeOrderText(address, 500);

        const voucherData = await validateVoucher(supabase, voucherCode);
        if (voucherCode && !voucherData) {
            return NextResponse.json(
                { error: "Voucher not valid" },
                { status: 400 },
            );
        }

        const voucherId = voucherData?.voucherid || null;
        const cartItems = await fetchCartItems(supabase, validCartId, user.id);

        const finalPrice = await calculateFinalPrice(
            supabase,
            cartItems,
            voucherId,
        );

        const orderData = {
            order_status: "Pending",
            order_date: new Date().toISOString(),
            order_price: finalPrice.toFixed(2),
            message: safeMessage,
            delivery_address: safeAddress,
            customerid: user.id,
            voucherid: voucherId,
            paymentMethod: validPaymentMethod,
            payment_img: payment_img ?? null,
        };

        const orderId = await insertOrder(supabase, orderData);
        await persistOrderSideEffects(
            supabase,
            validCartId,
            cartItems,
            orderId,
            voucherId,
        );

        return NextResponse.json({ orderId }, { status: 200 });
    } catch (err) {
        if (err instanceof OrderApiError) {
            return NextResponse.json(
                { error: err.message },
                { status: err.status },
            );
        }

        console.error("Order API error:", err);
        return NextResponse.json(
            { error: "Unexpected server error" },
            { status: 500 },
        );
    }
}
