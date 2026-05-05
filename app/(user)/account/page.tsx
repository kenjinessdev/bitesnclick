"use client";
import React, { useEffect, useState } from "react";
import { CircleUserRoundIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { ClipLoader } from "react-spinners";
import EditAccountModal from "@/app/components/modal/account_modify/edit_account";
import { useRouter } from "next/navigation";

export default function Home() {
    const [customerDetails, setCustomerDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editModalOpen, setEditModalOpen] = React.useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchCustomerDetails = async () => {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                setError(userError.message);
                setLoading(false);
                return;
            }

            if (!user) {
                router.replace("/");
                setError("User not logged in.");
                setLoading(false);
                return;
            }

            const metadata = (user.user_metadata ?? {}) as Record<
                string,
                string
            >;
            setCustomerDetails({
                first_name: metadata.first_name ?? "",
                last_name: metadata.last_name ?? "",
                email: user.email ?? metadata.email ?? "",
                mobile_num: metadata.mobile_num ?? "",
                street_address: metadata.street_address ?? "",
                city: metadata.city ?? "",
                barangay: metadata.barangay ?? "",
                zipcode: metadata.zipcode ?? "",
            });
            setLoading(false);
        };

        fetchCustomerDetails();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <ClipLoader color="#E19517" size={50} />
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500">{error}</div>;
    }

    return (
        <>
            <div className="flex flex-col mx-6 md:mx-30 mb-10">
                <div className="flex h-15 items-end">
                    <span className="font-bold text-2xl md:text-4xl text-[#240C03] text-end">
                        Profile Information
                    </span>
                </div>
                <div className="flex flex-col rounded-3xl mt-5 shadow-[0px_4px_16px_rgba(17,17,26,0.1),_0px_8px_24px_rgba(17,17,26,0.1),_0px_16px_56px_rgba(17,17,26,0.1)]">
                    <div className="w-full h-15 md:h-20 bg-gradient-to-r rounded-tr-3xl rounded-tl-3xl from-[#FE7521] to-[#E19517]"></div>
                    <div className="flex flex-col md:flex-row justify-between mx-5 md:mx-20 py-5">
                        <div className="flex flex-col md:flex-row gap-x-5 items-center md:items-start">
                            <CircleUserRoundIcon
                                size={50}
                            ></CircleUserRoundIcon>
                            <div className="flex flex-col items-center md:items-start">
                                <span className="text-lg font-semibold text-[#240C03]">
                                    {customerDetails?.first_name}{" "}
                                    {customerDetails?.last_name}
                                </span>
                                <span className="text-sm text-gray-600">
                                    {customerDetails?.email}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setEditModalOpen(true)}
                            className="items-center mt-5 md:mt-0 text-amber-50 font-xs h-10 bg-[#E19517]  hover:bg-amber-600 rounded-4xl px-5 cursor-pointer"
                        >
                            Edit
                        </button>
                    </div>
                    <div className="mx-5 md:mx-15 mb-10">
                        <form className="space-y-4 mt-5 w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-x-15 w-full">
                                <div className="w-full">
                                    <label
                                        htmlFor="first-name"
                                        className="block text-sm font-medium text-[#240C03]"
                                    >
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        id="first-name"
                                        name="firstName"
                                        placeholder={
                                            customerDetails?.first_name || ""
                                        }
                                        readOnly
                                        className="w-full px-4 py-2 mt-1 border border-gray-400 rounded-md focus:outline-none"
                                    />
                                </div>
                                <div className="w-full">
                                    <label
                                        htmlFor="last-name"
                                        className="block text-sm font-medium text-[#240C03]"
                                    >
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        id="last-name"
                                        name="lastName"
                                        placeholder={
                                            customerDetails?.last_name || ""
                                        }
                                        readOnly
                                        className="w-full px-4 py-2 mt-1 border border-gray-400 rounded-md focus:outline-none"
                                    />
                                </div>
                                <div className="w-full">
                                    <label
                                        htmlFor="email"
                                        className="block text-sm font-medium text-[#240C03]"
                                    >
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        placeholder={
                                            customerDetails?.email || ""
                                        }
                                        readOnly
                                        className="w-full px-4 py-2 mt-1 border border-gray-400 rounded-md focus:outline-none"
                                    />
                                </div>
                                <div className="w-full">
                                    <label
                                        htmlFor="mobile-number"
                                        className="block text-sm font-medium text-[#240C03]"
                                    >
                                        Mobile Number
                                    </label>
                                    <input
                                        type="tel"
                                        id="mobile-number"
                                        name="mobileNumber"
                                        placeholder={
                                            customerDetails?.mobile_num || ""
                                        }
                                        readOnly
                                        className="w-full px-4 py-2 mt-1 border border-gray-400 rounded-md focus:outline-none"
                                    />
                                </div>
                                <div className="w-full">
                                    <label
                                        htmlFor="street-address"
                                        className="block text-sm font-medium text-[#240C03]"
                                    >
                                        Street Address
                                    </label>
                                    <input
                                        type="text"
                                        id="street-address"
                                        name="streetAddress"
                                        placeholder={
                                            customerDetails?.street_address ||
                                            ""
                                        }
                                        readOnly
                                        className="w-full px-4 py-2 mt-1 border border-gray-400 rounded-md focus:outline-none"
                                    />
                                </div>
                                <div className="w-full">
                                    <label
                                        htmlFor="city"
                                        className="block text-sm font-medium text-[#240C03]"
                                    >
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        id="city"
                                        name="city"
                                        placeholder={
                                            customerDetails?.city || ""
                                        }
                                        readOnly
                                        className="w-full px-4 py-2 mt-1 border border-gray-400 rounded-md focus:outline-none"
                                    />
                                </div>
                                <div className="w-full">
                                    <label
                                        htmlFor="barangay"
                                        className="block text-sm font-medium text-[#240C03]"
                                    >
                                        Barangay
                                    </label>
                                    <input
                                        type="text"
                                        id="barangay"
                                        name="barangay"
                                        placeholder={
                                            customerDetails?.barangay || ""
                                        }
                                        readOnly
                                        className="w-full px-4 py-2 mt-1 border border-gray-400 rounded-md focus:outline-none"
                                    />
                                </div>
                                <div className="w-full">
                                    <label
                                        htmlFor="zip-code"
                                        className="block text-sm font-medium text-[#240C03]"
                                    >
                                        Zip Code
                                    </label>
                                    <input
                                        type="text"
                                        id="zip-code"
                                        name="zipCode"
                                        placeholder={
                                            customerDetails?.zipcode || ""
                                        }
                                        readOnly
                                        className="w-full px-4 py-2 mt-1 border border-gray-400 rounded-md focus:outline-none"
                                    />
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            {editModalOpen && (
                <EditAccountModal onClose={() => setEditModalOpen(false)} />
            )}
        </>
    );
}
