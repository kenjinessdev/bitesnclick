"use client";
import ChangeAddressModal from "@/app/components/modal/orders_modify/changeAddress_modal";
import OrderedProductsCard from "@/app/components/model/ordered-products-card";
import { MapPin, MessageCircleMore, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";
import PaymentMethodModal from "@/app/components/modal/orders_modify/payment_method_modal";
import InputVoucherModal from "@/app/components/modal/orders_modify/inputVoucher_modal";
import { useRouter } from "next/dist/client/components/navigation";
import PaymentModal from "@/app/components/modal/orders_modify/payment_modal";
import SuccessModal from "@/app/components/modal/success_modal";
import { toast, ToastContainer } from "react-toastify";

function safeText(text: any) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function normalize(text: string) {
    return text.replace(/\s+/g, " ").trim();
}

export default function Home() {
    const router = useRouter();
    const [changeAdress, setChangeAddress] = useState(false);
    const [showPaymentMethodModal, setPaymentMethodModal] = useState(false);
    const [showInputVoucherModal, setInputVoucherModal] = useState(false);
    const [paymentModal, setPaymentModal] = useState(false);
    const [customerData, setCustomerData] = useState<any>(null);
    const [voucherDiscount, setVoucherDiscount] = useState<number>(0);
    const [finalPrice, setfinalPrice] = useState<number>(0);
    const [cartItemsId, setCartItemsId] = useState<string[] | null>(null);
    const [cartId, setCartId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirmedPayment, setConfirmedPayment] = useState(false);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
    const [paymentImage, setPaymentImage] = useState<string>("");
    const [voucherCode, setVoucherCode] = useState<string | null>(null);
    const [successModal, setSuccessModal] = useState(false);
    const [showtotalPrice, setTotalPrice] = useState<number>(0);
    const [address, setAddress] = useState<{
        street: string;
        barangay: string;
        city: string;
        zipcode: string;
    } | null>(null);
    const notify = (message: string) => toast.success(message);

    const calculateFinalPrice = (totalPrice: number, discount: number) => {
        if (totalPrice === 0) {
            setfinalPrice(0);
            return;
        }
        if (discount === 0) {
            setfinalPrice(totalPrice + 40);
            return;
        }
        const amountWithDelivery = totalPrice + 40;
        const discountAmount = (amountWithDelivery * discount) / 100;
        const totalAmount = amountWithDelivery - discountAmount;
        setfinalPrice(totalAmount);
    };

    const calculateTotalPrice = async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                console.warn("User not authenticated");
                return;
            }

            const { data: cartData, error: cartError } = await supabase
                .from("cart")
                .select("cartid")
                .eq("customerid", user.id)
                .single();

            if (cartError || !cartData) {
                console.warn("Cannot calculate total price: cartId not found");
                return;
            }

            const cartId = cartData.cartid;
            console.log("Calculating total price for cart ID:", cartId);

            const { data: cartItems, error: itemsError } = await supabase
                .from("cart_items")
                .select("total_price")
                .eq("cartid", cartId);

            if (itemsError) throw itemsError;

            const totalPrice = cartItems.reduce(
                (sum, item) => sum + item.total_price,
                0,
            );

            setTotalPrice(totalPrice);
        } catch (error) {
            console.error("Error calculating total price:", error);
        }
    };

    useEffect(() => {
        const fetchCustomerData = async () => {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                console.error("Error fetching user:", userError);
                return null;
            }

            if (!user) {
                console.warn("User not authenticated");
                return null;
            }

            const metadata = (user.user_metadata ?? {}) as Record<
                string,
                string
            >;
            const details = {
                first_name: metadata.first_name ?? "",
                last_name: metadata.last_name ?? "",
                email: user.email ?? metadata.email ?? "",
                mobile_num: metadata.mobile_num ?? "",
                street_address: metadata.street_address ?? "",
                city: metadata.city ?? "",
                barangay: metadata.barangay ?? "",
                zipcode: metadata.zipcode ?? "",
            };

            setCustomerData(details);
            setAddress({
                street: details.street_address,
                barangay: details.barangay,
                city: details.city,
                zipcode: details.zipcode,
            });
            return details;
        };

        async function fetchCartData() {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                const { data: cartData, error: cartError } = await supabase
                    .from("cart")
                    .select("cartid")
                    .eq("customerid", user?.id)
                    .single();

                if (cartError) {
                    console.error("Error fetching cart:", cartError);
                    setCartItemsId(null);
                    return;
                }

                if (cartData) {
                    setCartId(cartData.cartid);
                    const { data: itemsData, error: itemsError } =
                        await supabase
                            .from("cart_items")
                            .select("cart_itemsid")
                            .eq("cartid", cartData.cartid);

                    if (itemsError) {
                        console.error("Error fetching cart items:", itemsError);
                        setCartItemsId(null);
                        return;
                    }

                    if (itemsData && itemsData.length > 0) {
                        setCartItemsId(
                            itemsData.map((item) => item.cart_itemsid),
                        );
                        setCartId(cartData.cartid);
                    } else {
                        setCartItemsId(null);
                    }
                } else {
                    setCartItemsId(null);
                }
            } catch (error) {
                console.error("Unexpected error:", error);
                setCartItemsId(null);
            } finally {
                setLoading(false);
            }
        }

        fetchCartData();
        fetchCustomerData();
        calculateTotalPrice();
        calculateFinalPrice(showtotalPrice, voucherDiscount);
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <ClipLoader color="#E19517" size={50} />
            </div>
        );
    }

    const handleAddressChange = (newAddress: any) => {
        setAddress(newAddress);
    };

    const handleVoucherChange = async (voucher: string) => {
        try {
            // Validate voucher format first
            const voucherRegex = /^[A-Z0-9_-]{3,20}$/;

            if (!voucherRegex.test(voucher)) {
                alert("Invalid voucher code format.");
                return;
            }
            const { data, error } = await supabase
                .from("vouchers")
                .select("*")
                .eq("code", voucher)
                .single();

            if (error) {
                console.error("Error fetching voucher:", error);
                return;
            }

            if (data) {
                setVoucherDiscount(data.percent);
                setVoucherCode(voucher);
                calculateFinalPrice(showtotalPrice, data.percent);
                notify("Voucher applied successfully.");
            } else {
                console.log("No voucher found with the given code.");
            }
        } catch (error) {
            console.error("Error fetching voucher:", error);
        }
    };

    const handlePaymentMethodChange = (method: string) => {
        console.log("Selected payment method:", method);
        notify("Payment method saved successfully.");
        setPaymentMethod(method);
    };

    const handleSubmit = () => {
        if (isPlacingOrder) return;

        setIsPlacingOrder(true);
        if (paymentMethod === "GCASH" && !confirmedPayment) {
            setPaymentModal(true);
            setIsPlacingOrder(false);
        } else {
            placeOrder();
        }
    };

    const placeOrder = async (imageUrl?: string) => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                console.warn("User not authenticated");
                return;
            }

            if (!paymentMethod) {
                alert("Please select a payment method.");
                return;
            }

            let voucherId = null;

            if (voucherCode) {
                const { data: voucherData, error: voucherError } =
                    await supabase
                        .from("vouchers")
                        .select("voucherid")
                        .eq("code", voucherCode)
                        .single();

                if (voucherError) {
                    console.error("Error fetching voucher ID:", voucherError);
                } else {
                    voucherId = voucherData?.voucherid || null;
                }
            }

            const messageElement =
                document.querySelector<HTMLTextAreaElement>("textarea");

            let message = normalize(messageElement?.value || "");

            // limit length
            if (message.length > 300) {
                return alert("Message too long (max 300 characters).");
            }

            // sanitize
            message = safeText(message);
            if (!address?.street || !address?.barangay) {
                alert("Invalid delivery address.");
                return;
            }

            // length limits
            if (address.street.length > 100) {
                alert("Street address too long.");
                return;
            }

            if (address.barangay.length > 50) {
                alert("Barangay name too long.");
                return;
            }

            const addressRegex = /^[a-zA-Z0-9\s.,'#-]+$/;

            if (!addressRegex.test(address.street)) {
                alert("Invalid street address.");
                return;
            }

            if (!addressRegex.test(address.barangay)) {
                alert("Invalid barangay.");
                return;
            }
            const orderPayload = {
                cartId: cartId,
                message: message,
                address: `${address?.street}, ${address?.barangay}, ${address?.city}, Davao Del Sur, ${address?.zipcode}`,
                paymentMethod: paymentMethod,
                payment_img: imageUrl ?? null,
                voucherCode: voucherCode ?? null,
            };

            const response = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(orderPayload),
            });

            if (!response.ok) {
                const errData = await response.json();
                console.error("Error placing order via API:", errData.error);
                alert(`Error placing order: ${errData.error}`);
                return;
            }

            setSuccessModal(true);
            console.log(
                "Order placed, order details inserted, and cart cleared successfully!",
            );

            setTimeout(() => {
                setIsPlacingOrder(true);
                router.push("/orders");
                setSuccessModal(false);
            }, 4000);
        } catch (error) {
            console.error("Unexpected error placing order:", error);
        } finally {
            setIsPlacingOrder(false);
        }
    };

    return (
        <>
            <div className="mt-5 mx-6 md:mx-30 relative overflow-hidden">
                <span className="font-bold text-2xl md:text-4xl text-[#240C03] text-end">
                    Place Order
                </span>
                <div className="relative p-6 mt-5 border-b-1 border-gray-300 rounded-2xl shadow-[0px_4px_16px_rgba(17,17,26,0.1),_0px_8px_24px_rgba(17,17,26,0.1),_0px_16px_56px_rgba(17,17,26,0.1)]">
                    <div className="absolute inset-0 border-dashed border-t-[4px] border-transparent z-[-1] border-gradient-dash rounded-xl"></div>
                    <div className="flex flex-col rounded-xl gap-y-2 ">
                        <div className="flex items-center gap-x-2">
                            <MapPin className="text-[#E19517] w-6 h-6" />
                            <span className="font-medium text-[#E19517] text-xl">
                                Delivery Address
                            </span>
                        </div>
                        <div className="flex justify-between mx-10">
                            <div className="flex flex-col">
                                <span className="text-[#240C03] font-semibold">
                                    {safeText(customerData?.first_name)}{" "}
                                    {safeText(customerData?.last_name)}
                                </span>
                                <span className="text-[#240C03]">
                                    {safeText(customerData?.mobile_num)}
                                </span>
                            </div>
                            <span>
                                {safeText(address?.street)},{" "}
                                {safeText(address?.barangay)},{" "}
                                {safeText(address?.city)}, Davao Del Sur,{" "}
                                {safeText(address?.zipcode)}
                            </span>
                            <button
                                className="border-2 border-[#E19517] rounded-lg h-fit py-2 px-5 hover:bg-[#E19517] hover:text-amber-50 cursor-pointer text-[#E19517] text-sm font-medium ease-in-out duration-200"
                                onClick={() => setChangeAddress(true)}
                            >
                                Change
                            </button>
                        </div>
                    </div>
                </div>
                {/* Products ordered */}
                <div className="flex flex-col rounded-2xl my-5 w-full shadow-[0px_4px_16px_rgba(17,17,26,0.1),_0px_8px_24px_rgba(17,17,26,0.1),_0px_16px_56px_rgba(17,17,26,0.1)]">
                    <div className="border-b-1 border-gray-300 rounded-2xl">
                        <div className="flex py-5 px-10">
                            <span className="w-250">Products Ordered</span>
                            <div className="flex justify-between w-full">
                                <span>Unit Price</span>
                                <span>Quantity</span>
                                <span>Total Price</span>
                            </div>
                        </div>
                        <div className="">
                            {cartItemsId && cartItemsId.length > 0 ? (
                                cartItemsId.map((id) => (
                                    <OrderedProductsCard
                                        key={id}
                                        cartitemsId={id}
                                        cartid={cartId || ""}
                                    />
                                ))
                            ) : (
                                <span className="flex justify-center text-gray-500">
                                    No items selected.
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-row">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-x-2 w-150 py-5 px-5 border-b-1 border-gray-300">
                                <MessageCircleMore className="text-[#E19517] w-6 h-6" />
                                <span className="text-lg">
                                    Message for seller:
                                </span>
                            </div>
                            <div className="mt-2 mx-10">
                                <textarea
                                    className="w-full h-50 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E19517]"
                                    placeholder="Type your message here..."
                                ></textarea>
                            </div>
                        </div>
                        <div className="flex flex-col border-l-1 border-gray-300 w-full">
                            <div className="flex justify-between items-center border-b-1 border-gray-300">
                                <div className="flex items-center gap-x-2 w-fit py-5 px-5">
                                    <CreditCard className="text-[#E19517] w-6 h-6" />
                                    <span className="text-lg">
                                        Method of Payment
                                    </span>
                                </div>
                                <button
                                    className="border-2 border-[#E19517] rounded-lg h-fit py-2 px-5 hover:bg-[#E19517] hover:text-amber-50 cursor-pointer text-[#E19517] text-sm font-medium ease-in-out duration-200"
                                    onClick={() => setPaymentMethodModal(true)}
                                >
                                    Select
                                </button>
                            </div>
                            <div
                                className="px-5 py-1 flex justify-end bg-[#E19517]/30 cursor-pointer"
                                onClick={() => setInputVoucherModal(true)}
                            >
                                <span className="text-sm text-gray-700 font-light">
                                    {"Add Voucher >>"}
                                </span>
                            </div>
                            <div className="flex justify-between mx-10 mt-2">
                                <div className="flex flex-col gap-y-2">
                                    <div className="flex gap-x-5">
                                        <span className="text-lg">
                                            Method:{" "}
                                        </span>
                                        <span className="text-lg text-gray-500">
                                            {paymentMethod}
                                        </span>
                                    </div>
                                    <div className="flex gap-x-5">
                                        <span className="text-lg">
                                            Voucher:{" "}
                                        </span>
                                        <span className="text-lg text-gray-500">
                                            {voucherCode}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-y-4">
                                    <div className="flex justify-between gap-x-10">
                                        <span>Product subtotal:</span>
                                        <span className="text-gray-600">
                                            ₱ {showtotalPrice.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Delivery fee:</span>
                                        <span className="text-gray-600">
                                            ₱ 40.00
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span>Voucher:</span>
                                        <span className="border-b-1 text-right w-30 border-gray-500 text-gray-600">
                                            {voucherDiscount} %
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-2xl">Total:</span>
                                        <span className="text-2xl text-[#E19517] font-semibold">
                                            ₱{" "}
                                            {finalPrice === 0
                                                ? (showtotalPrice + 40).toFixed(
                                                      2,
                                                  )
                                                : finalPrice.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end my-5">
                    <button
                        className={`mt-5 bg-[#E19517] text-2xl text-white w-fit font-bold py-3 px-6 rounded-lg cursor-pointer transition duration-200 ${
                            isPlacingOrder
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-[#d08414]"
                        }`}
                        onClick={handleSubmit}
                        disabled={isPlacingOrder}
                    >
                        {isPlacingOrder ? (
                            <div className="flex items-center justify-center gap-2">
                                <ClipLoader color="#fff" size={20} />
                                <span>Placing Order...</span>
                            </div>
                        ) : (
                            "Place Order"
                        )}
                    </button>
                </div>
            </div>
            {changeAdress && (
                <ChangeAddressModal
                    onClose={() => setChangeAddress(false)}
                    onAddressChange={handleAddressChange}
                    name={`${customerData?.first_name} ${customerData?.last_name}`}
                    phone={customerData?.mobile_num}
                    address={`${address?.street}, ${address?.barangay}, ${address?.city}, Davao
                Del Sur, ${address?.zipcode}`}
                />
            )}
            {showPaymentMethodModal && (
                <PaymentMethodModal
                    onClose={() => setPaymentMethodModal(false)}
                    onSelectPaymentMethod={handlePaymentMethodChange}
                    method={paymentMethod || ""}
                />
            )}
            {showInputVoucherModal && (
                <InputVoucherModal
                    onClose={() => setInputVoucherModal(false)}
                    onVoucherApply={handleVoucherChange}
                    code={voucherCode || ""}
                />
            )}
            {paymentModal && (
                <PaymentModal
                    onClose={() => setPaymentModal(false)}
                    onImageUpload={placeOrder}
                />
            )}
            {successModal && (
                <SuccessModal onClose={() => setSuccessModal(false)} />
            )}
            <ToastContainer theme="light" position="bottom-left" />
        </>
    );
}
