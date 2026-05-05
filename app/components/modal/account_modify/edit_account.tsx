import { supabase } from "@/lib/supabase/client";
import { safeText } from "@/lib/utils/sanitize";
import { Eye, EyeOff, X } from "lucide-react";
import router, { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import ConfirmationModal from "../confirmation_modal";
import ClipLoader from "react-spinners/ClipLoader";

// Validation stuffs
const nameRegex = /^[a-zA-Z\s'-]+$/;
const phoneRegex = /^09\d{9}$/;

function limitLength(value: string, max: number) {
    return value.length <= max;
}

interface EditAccountModalProps {
    onClose: () => void;
}

const EditAccountModal: React.FC<EditAccountModalProps> = ({ onClose }) => {
    const [customerDetails, setCustomerDetails] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showRePassword, setReShowPassword] = useState(false);
    const [showEditPassword, setEditPassword] = useState(false);
    const [showOldPassword, setOldPassword] = useState(false);
    const router = useRouter();
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] =
        useState(false);
    const [loading, setLoading] = useState(false);

    const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    useEffect(() => {
        setLoading(true);
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

    const handleEditAccount = async () => {
        if (!formRef.current) return;
        const form = formRef.current;

        const firstName = form.firstName.value.trim();
        const lastName = form.lastName.value.trim();
        const mobileNumber = form.mobileNumber.value.trim();
        const streetAddress = form.streetAddress.value.trim();
        const city = form.city.value.trim();
        const barangay = form.barangay.value.trim();
        const zipCode = form.zipCode?.value?.trim() ?? "";

        const oldPassword = form.oldPassword?.value;
        const newPassword = form.newPassword?.value;
        const confirmPassword = form.rePassword?.value;

        Array.from(form.elements).forEach((el) => {
            if (el instanceof HTMLInputElement) {
                el.classList.remove("border-red-500");
            }
        });

        // Validation
        const requiredFields = [
            { name: "firstName", value: firstName },
            { name: "lastName", value: lastName },
            { name: "mobileNumber", value: mobileNumber },
            { name: "streetAddress", value: streetAddress },
            { name: "city", value: city },
            { name: "barangay", value: barangay },
        ];

        let hasError = false;
        requiredFields.forEach(({ name, value }) => {
            const input = form[name];
            if (!value) {
                input.classList.add("border-red-500");
                hasError = true;
            }
        });

        if (hasError) {
            setError("Please fill in all required fields.");
            alert("Please fill in all required fields.");
            return;
        }

        //More validations

        // Name validation
        if (!nameRegex.test(firstName)) {
            form.firstName.classList.add("border-red-500");
            return alert("Invalid first name.");
        }

        if (!nameRegex.test(lastName)) {
            form.lastName.classList.add("border-red-500");
            return alert("Invalid last name.");
        }

        // Mobile validation (PH format)
        if (!phoneRegex.test(mobileNumber)) {
            form.mobileNumber.classList.add("border-red-500");
            return alert("Invalid mobile number (must be 09XXXXXXXXX).");
        }

        // Length limits
        if (!limitLength(streetAddress, 100)) {
            form.streetAddress.classList.add("border-red-500");
            return alert("Street address too long.");
        }

        if (!limitLength(city, 50)) {
            form.city.classList.add("border-red-500");
            return alert("City name too long.");
        }

        if (!limitLength(barangay, 50)) {
            form.barangay.classList.add("border-red-500");
            return alert("Barangay name too long.");
        }

        if (showEditPassword) {
            if (!oldPassword || !newPassword || !confirmPassword) {
                if (!oldPassword)
                    form.oldPassword.classList.add("border-red-500");
                if (!newPassword)
                    form.newPassword.classList.add("border-red-500");
                if (!confirmPassword)
                    form.rePassword.classList.add("border-red-500");

                setError("Please fill in all password fields.");
                alert("Please fill in all password fields.");
                return;
            }

            if (newPassword !== confirmPassword) {
                form.newPassword.classList.add("border-red-500");
                form.rePassword.classList.add("border-red-500");
                setError("New password and confirmation do not match.");
                alert("New password and confirmation do not match.");
                return;
            }

            if (newPassword.length < 6) {
                form.newPassword.classList.add("border-red-500");
                setError("Password must be at least 6 characters.");
                alert("Password must be at least 6 characters.");
                return;
            }
        }

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();
        if (!user) {
            setError("User not found.");
            return;
        }

        const displayName = `${firstName} ${lastName}`;
        const safeFirstName = safeText(firstName);
        const safeLastName = safeText(lastName);
        const safeMobileNumber = safeText(mobileNumber);
        const safeStreetAddress = safeText(streetAddress);
        const safeCity = safeText(city);
        const safeBarangay = safeText(barangay);
        const safeZipCode = safeText(zipCode);

        try {
            const { error: updateError } = await supabase
                .from("customers")
                .update({
                    first_name: safeFirstName,
                    last_name: safeLastName,
                    mobile_num: safeMobileNumber,
                    street_address: safeStreetAddress,
                    city: safeCity,
                    barangay: safeBarangay,
                    zipcode: safeZipCode,
                })
                .eq("customerid", user.id);

            if (updateError) throw new Error(updateError.message);

            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    display_name: displayName,
                    first_name: safeFirstName,
                    last_name: safeLastName,
                    mobile_num: safeMobileNumber,
                    street_address: safeStreetAddress,
                    city: safeCity,
                    barangay: safeBarangay,
                    zipcode: safeZipCode,
                },
            });

            if (authError) throw new Error(authError.message);

            if (showEditPassword) {
                const { error: signInError } =
                    await supabase.auth.signInWithPassword({
                        email: customerDetails.email,
                        password: oldPassword,
                    });

                if (signInError) throw new Error("Old password is incorrect.");

                const { error: passError } = await supabase.auth.updateUser({
                    password: newPassword,
                });

                if (passError) throw new Error(passError.message);
            }

            console.log("Account updated successfully.");
            window.location.reload();
            onClose();
        } catch (err: any) {
            console.error("Error updating account:", err.message);
            setError(err.message);
            alert(err.message);
        }
    };

    const handleDeleteAccount = async () => {
        setShowDeleteConfirmationModal(false);
        setLoading(true);
        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (!user) {
                setError("User not found.");
                setLoading(false);
                return;
            }

            const response = await fetch("/lib/delete-account", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId: user.id }),
            });

            const responseData = await response.json();
            console.log("Response:", responseData);

            if (!response.ok) {
                setError(responseData.error || "Failed to delete account");
                setLoading(false);
                return;
            }

            if (responseData.success) {
                alert("Account deleted successfully.");
                await supabase.auth.signOut();
                localStorage.clear();
                router.replace("/");
                window.location.reload();
            } else {
                setError("An error occurred while deleting the account.");
                setLoading(false);
            }
        } catch (err: any) {
            console.error("Error deleting account:", err);
            setError(err.message || "Unexpected error occurred.");
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-30"
            onClick={handleOverlayClick}
        >
            <div
                className="relative flex flex-col bg-white rounded-lg shadow-lg w-full md:w-fit h-full md:h-140 my-10 p-10 overflow-scroll [&::-webkit-scrollbar]:hidden scrollbar-thin scrollbar-none"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="absolute flex cursor-pointer items-center justify-center top-5 right-5 w-10 h-10"
                    onClick={onClose}
                >
                    <X className="text-[#240C03] font-bold" />
                </button>
                <div className="flex w-full justify-center border-b-3 pb-2 border-[#E19517]">
                    <span className="font-semibold text-xl">Edit Profile</span>
                </div>

                {loading && (
                    <div className="inset-0 z-40 bg-white/60 w-138 h-100 flex items-center justify-center rounded-lg">
                        <ClipLoader color="#E19517" size={50} />
                    </div>
                )}

                {!loading && (
                    <div className="mx-5">
                        <form
                            ref={formRef}
                            className="space-y-2 mt-5 w-full"
                            onSubmit={(e) => {
                                e.preventDefault();
                                setShowConfirmationModal(true);
                            }}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-x-10 w-full">
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
                                        defaultValue={safeText(
                                            customerDetails?.first_name || "",
                                        )}
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
                                        defaultValue={safeText(
                                            customerDetails?.last_name || "",
                                        )}
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
                                        placeholder={safeText(
                                            customerDetails?.email || "",
                                        )}
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
                                        defaultValue={safeText(
                                            customerDetails?.mobile_num || "",
                                        )}
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
                                        defaultValue={safeText(
                                            customerDetails?.street_address ||
                                                "",
                                        )}
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
                                        defaultValue={safeText(
                                            customerDetails?.city || "",
                                        )}
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
                                        defaultValue={safeText(
                                            customerDetails?.barangay || "",
                                        )}
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
                                        defaultValue={safeText(
                                            customerDetails?.zipcode || "",
                                        )}
                                        className="w-full px-4 py-2 mt-1 border border-gray-400 rounded-md focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-center mt-3">
                                    <input
                                        type="checkbox"
                                        id="editPassword"
                                        checked={showEditPassword}
                                        onChange={() =>
                                            setEditPassword(!showEditPassword)
                                        }
                                        className="mr-2 accent-[#E19517] scale-120"
                                    />
                                    <label
                                        htmlFor="editPassword"
                                        className="text-sm text-[#240C03]"
                                    >
                                        Change Password
                                    </label>
                                </div>

                                {showEditPassword && (
                                    <>
                                        <div className=""></div>
                                        <div className="w-full relative">
                                            <label
                                                htmlFor="password"
                                                className="block text-sm font-medium text-[#240C03]"
                                            >
                                                Old Password
                                            </label>
                                            <input
                                                type={
                                                    showOldPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                id="oldPassword"
                                                name="oldPassword"
                                                className="w-full px-4 py-2 mt-1 border rounded-md border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E19517]"
                                            />
                                            <span
                                                onClick={() =>
                                                    setOldPassword(
                                                        !showOldPassword,
                                                    )
                                                }
                                                className="absolute right-3 top-9 cursor-pointer text-[#E19517]"
                                            >
                                                {showOldPassword ? (
                                                    <EyeOff size={20} />
                                                ) : (
                                                    <Eye size={20} />
                                                )}
                                            </span>
                                        </div>
                                        <div className="w-full relative">
                                            <label
                                                htmlFor="password"
                                                className="block text-sm font-medium text-[#240C03]"
                                            >
                                                New Password
                                            </label>
                                            <input
                                                type={
                                                    showPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                id="newPassword"
                                                name="newPassword"
                                                className="w-full px-4 py-2 mt-1 border rounded-md focus:outline-none border-gray-400 focus:ring-2 focus:ring-[#E19517]"
                                            />
                                            <span
                                                onClick={() =>
                                                    setShowPassword(
                                                        !showPassword,
                                                    )
                                                }
                                                className="absolute right-3 top-9 cursor-pointer text-[#E19517]"
                                            >
                                                {showPassword ? (
                                                    <EyeOff size={20} />
                                                ) : (
                                                    <Eye size={20} />
                                                )}
                                            </span>
                                        </div>

                                        <div className="w-full relative">
                                            <label
                                                htmlFor="repassword"
                                                className="block text-sm font-medium text-[#240C03]"
                                            >
                                                Confirm New Password
                                            </label>
                                            <input
                                                type={
                                                    showRePassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                id="rePassword"
                                                name="rePassword"
                                                className="w-full px-4 py-2 mt-1 border rounded-md border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E19517]"
                                            />
                                            <span
                                                onClick={() =>
                                                    setReShowPassword(
                                                        !showRePassword,
                                                    )
                                                }
                                                className="absolute right-3 top-9 cursor-pointer text-[#E19517]"
                                            >
                                                {showRePassword ? (
                                                    <EyeOff size={20} />
                                                ) : (
                                                    <Eye size={20} />
                                                )}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="flex justify-between items-center pt-6">
                                <a
                                    onClick={() =>
                                        setShowDeleteConfirmationModal(true)
                                    }
                                    className="font-light text-sm text-gray-400 underline cursor-pointer"
                                >
                                    Delete Account
                                </a>
                                <div className="flex gap-x-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="border-2 border-[#E19517] rounded-lg py-1 px-4 cursor-pointer text-[#E19517] font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="border-2 border-[#E19517] bg-[#E19517] rounded-lg py-1 px-4 cursor-pointer text-amber-50 font-medium"
                                    >
                                        Update
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {showConfirmationModal && (
                <ConfirmationModal
                    onClose={() => setShowConfirmationModal(false)}
                    onConfirm={handleEditAccount}
                    buttonText="Update"
                    title="Confirm Changes"
                    description="Are you sure you want to update your account?"
                />
            )}

            {showDeleteConfirmationModal && (
                <ConfirmationModal
                    onClose={() => setShowDeleteConfirmationModal(false)}
                    onConfirm={handleDeleteAccount}
                    buttonText="Delete"
                    title="Delete Account"
                    description="Are you sure you want to permanently delete your account?"
                />
            )}
        </div>
    );
};

export default EditAccountModal;
