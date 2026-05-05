"use client";

import React, { useRef, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase/client";
import VerificationModal from "./verification";
import HCaptchaWidget, {
    type HCaptchaWidgetHandle,
} from "@/app/components/hcaptcha/hcaptcha-widget";

const signUpSchema = z
    .object({
        firstName: z.string().min(1, "First name is required."),
        lastName: z.string().min(1, "Last name is required."),
        email: z.string().email("Enter a valid email address."),
        mobileNumber: z
            .string()
            .regex(/^(?:\+639|639|09|9)\d{9}$/, "Invalid mobile number."),
        streetAddress: z.string().min(1, "Street address is required."),
        city: z.string().min(1, "City is required."),
        barangay: z.string().min(1, "Barangay is required."),
        zipCode: z.string().min(1, "Zip code is required."),
        password: z
            .string()
            .min(6, "Password must be at least 6 characters.")
            .max(100, "Password is too long."),
        confirmPassword: z.string().min(1, "Confirm your password."),
        terms: z.boolean().refine((value) => value, {
            message: "Please accept the terms and conditions.",
        }),
        captchaToken: z.string().min(1, "Please complete the captcha."),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match.",
        path: ["confirmPassword"],
    });

type SignUpFormValues = z.infer<typeof signUpSchema>;

interface SignUpModalProps {
    onClose: () => void;
    onSwitchToLogin: () => void;
}

const SignUpModal: React.FC<SignUpModalProps> = ({
    onClose,
    onSwitchToLogin,
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showRePassword, setReShowPassword] = useState(false);
    const [verificationModalOpen, setVerificationModalOpen] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const captchaRef = useRef<HCaptchaWidgetHandle>(null);

    const {
        register,
        handleSubmit,
        setValue,
        clearErrors,
        formState: { errors, isSubmitting },
    } = useForm<SignUpFormValues>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            mobileNumber: "",
            streetAddress: "",
            city: "",
            barangay: "",
            zipCode: "",
            password: "",
            confirmPassword: "",
            terms: false,
            captchaToken: "",
        },
    });

    const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    const resetCaptcha = () => {
        captchaRef.current?.reset();
        setValue("captchaToken", "", { shouldValidate: true });
    };

    const onSubmit = async (values: SignUpFormValues) => {
        setSubmitError(null);

        const firstName = values.firstName.trim();
        const lastName = values.lastName.trim();
        const displayName = `${firstName} ${lastName}`.trim();
        const emailValue = values.email.trim();
        const mobileNumber = values.mobileNumber.trim();
        const streetAddress = values.streetAddress.trim();
        const city = values.city.trim();
        const barangay = values.barangay.trim();
        const zipCode = values.zipCode.trim();

        const { data: signUpData, error: signUpError } =
            await supabase.auth.signUp({
                email: emailValue,
                password: values.password,
                options: {
                    captchaToken: values.captchaToken,
                    data: {
                        display_name: displayName,
                        first_name: firstName,
                        last_name: lastName,
                        mobile_num: mobileNumber,
                        street_address: streetAddress,
                        city,
                        barangay,
                        zipcode: zipCode,
                    },
                },
            });

        if (signUpError) {
            setSubmitError(signUpError.message);
            resetCaptcha();
            return;
        }

        const userId = signUpData.user?.id;

        if (!userId) {
            setSubmitError("Unable to create account. Please try again.");
            resetCaptcha();
            return;
        }

        const { error: insertError } = await supabase.from("customers").insert([
            {
                customerid: userId,
                first_name: firstName,
                last_name: lastName,
                email: emailValue,
                mobile_num: mobileNumber,
                street_address: streetAddress,
                city,
                barangay,
                zipcode: zipCode,
            },
        ]);

        if (insertError) {
            setSubmitError(insertError.message);
            resetCaptcha();
            return;
        }

        setVerificationModalOpen(true);
        setEmail(emailValue);
        setPassword(values.password);
    };

    const inputClass = (hasError: boolean) =>
        `w-full px-4 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 ${
            hasError
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-400 focus:ring-[#E19517]"
        }`;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-30"
            onClick={handleOverlayClick}
        >
            <div
                className="relative flex flex-row bg-white rounded-lg shadow-lg w-full md:w-fit h-full md:h-fit p-10 overflow-auto max-h-screen"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="absolute flex cursor-pointer items-center justify-center top-5 right-5 w-10 h-10"
                    onClick={onClose}
                >
                    <X className="text-[#240C03] font-bold" />
                </button>
                <div className="flex flex-col items-center md:items-start px-6 w-150">
                    <h2 className="font-bold text-3xl text-[#240C03]">
                        Getting Started
                    </h2>
                    <p className="font-light py-2 text-sm text-[#240C03] border-b-2 border-[#E19517]">
                        We are thrilled to have you onboard. Create an account
                        by inputting the required fields.
                    </p>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-4 mt-5 w-full"
                    >
                        {submitError && (
                            <p className="text-red-500 ">{submitError}</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
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
                                    {...register("firstName")}
                                    className={inputClass(!!errors.firstName)}
                                />
                                {errors.firstName && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.firstName.message}
                                    </p>
                                )}
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
                                    {...register("lastName")}
                                    className={inputClass(!!errors.lastName)}
                                />
                                {errors.lastName && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.lastName.message}
                                    </p>
                                )}
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
                                    {...register("email")}
                                    className={inputClass(!!errors.email)}
                                />
                                {errors.email && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.email.message}
                                    </p>
                                )}
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
                                    {...register("mobileNumber")}
                                    className={inputClass(
                                        !!errors.mobileNumber,
                                    )}
                                />
                                {errors.mobileNumber && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.mobileNumber.message}
                                    </p>
                                )}
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
                                    {...register("streetAddress")}
                                    className={inputClass(
                                        !!errors.streetAddress,
                                    )}
                                />
                                {errors.streetAddress && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.streetAddress.message}
                                    </p>
                                )}
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
                                    {...register("city")}
                                    className={inputClass(!!errors.city)}
                                />
                                {errors.city && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.city.message}
                                    </p>
                                )}
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
                                    {...register("barangay")}
                                    className={inputClass(!!errors.barangay)}
                                />
                                {errors.barangay && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.barangay.message}
                                    </p>
                                )}
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
                                    {...register("zipCode")}
                                    className={inputClass(!!errors.zipCode)}
                                />
                                {errors.zipCode && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.zipCode.message}
                                    </p>
                                )}
                            </div>
                            <div className="w-full relative">
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-[#240C03]"
                                >
                                    Password
                                </label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    {...register("password")}
                                    className={inputClass(!!errors.password)}
                                />
                                <span
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-3 top-9 cursor-pointer text-[#E19517]"
                                >
                                    {showPassword ? (
                                        <EyeOff size={20} />
                                    ) : (
                                        <Eye size={20} />
                                    )}
                                </span>
                                {errors.password && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.password.message}
                                    </p>
                                )}
                            </div>

                            <div className="w-full relative">
                                <label
                                    htmlFor="confirm-password"
                                    className="block text-sm font-medium text-[#240C03]"
                                >
                                    Confirm Password
                                </label>
                                <input
                                    type={showRePassword ? "text" : "password"}
                                    id="confirm-password"
                                    {...register("confirmPassword")}
                                    className={inputClass(
                                        !!errors.confirmPassword,
                                    )}
                                />
                                <span
                                    onClick={() =>
                                        setReShowPassword(!showRePassword)
                                    }
                                    className="absolute right-3 top-9 cursor-pointer text-[#E19517]"
                                >
                                    {showRePassword ? (
                                        <EyeOff size={20} />
                                    ) : (
                                        <Eye size={20} />
                                    )}
                                </span>
                                {errors.confirmPassword && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.confirmPassword.message}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3 text-sm text-gray-500 items-start">
                            <input
                                type="checkbox"
                                id="terms"
                                {...register("terms")}
                            />
                            <span>
                                I have read and accept the{" "}
                                <a className="underline hover:text-[#E19517] cursor-pointer">
                                    terms and conditions
                                </a>
                                .
                            </span>
                        </div>
                        {errors.terms && (
                            <p className="text-xs text-red-500 -mt-2">
                                {errors.terms.message}
                            </p>
                        )}

                        <input type="hidden" {...register("captchaToken")} />
                        <div
                            className={
                                errors.captchaToken
                                    ? "rounded-md ring-2 ring-red-500"
                                    : ""
                            }
                        >
                            <HCaptchaWidget
                                ref={captchaRef}
                                onTokenChange={(token) => {
                                    setValue("captchaToken", token ?? "", {
                                        shouldValidate: true,
                                    });
                                    if (token) {
                                        clearErrors("captchaToken");
                                    }
                                }}
                            />
                        </div>
                        {errors.captchaToken && (
                            <p className="text-xs text-red-500">
                                {errors.captchaToken.message}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full px-4 py-2 text-white bg-[#E19517] rounded-md hover:bg-[#E19517]/90 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            {isSubmitting ? "Signing Up..." : "Sign Up"}
                        </button>
                        <p className="text-sm text-center text-gray-600 mb-10 md:mb-0">
                            Already have an account?{" "}
                            <a
                                onClick={onSwitchToLogin}
                                className="text-[#E19517] hover:underline cursor-pointer"
                            >
                                Sign In
                            </a>
                        </p>
                    </form>
                </div>
            </div>
            {verificationModalOpen && (
                <VerificationModal
                    email={email}
                    password={password}
                    onClose={() => setVerificationModalOpen(false)}
                    onSuccess={onClose}
                />
            )}
        </div>
    );
};

export default SignUpModal;
