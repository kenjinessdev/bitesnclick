"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import HCaptchaWidget, {
    type HCaptchaWidgetHandle,
} from "@/app/components/hcaptcha/hcaptcha-widget";

const loginSchema = z.object({
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(1, "Password is required."),
    captchaToken: z.string().min(1, "Please complete the captcha."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginModalProps {
    onClose: () => void;
    onSwitchToSignUp: () => void;
}

const animationBase = "transition-all duration-500 ease-in-out transform";
const animationHidden =
    "opacity-0 translate-x-10 pointer-events-none absolute top-0 left-0 w-full";
const animationVisible = "opacity-100 translate-x-0 relative";

const LoginModal: React.FC<LoginModalProps> = ({
    onClose,
    onSwitchToSignUp,
}) => {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [forgotError, setForgotError] = useState<string | null>(null);
    const [state, setState] = useState<"login" | "forgot">("login");
    const [forgotEmail, setForgotEmail] = useState<string>("");
    const [forgotMessage, setForgotMessage] = useState<string | null>(null);
    const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
    const [failCount, setFailCount] = useState<number>(0);
    const [forgotCaptchaToken, setForgotCaptchaToken] = useState<string | null>(
        null,
    );
    const loginCaptchaRef = useRef<HCaptchaWidgetHandle>(null);
    const forgotCaptchaRef = useRef<HCaptchaWidgetHandle>(null);

    const {
        register,
        handleSubmit,
        setValue,
        clearErrors,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
            captchaToken: "",
        },
    });

    useEffect(() => {
        setLoginError(null);
        setForgotError(null);
    }, [state]);

    const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    const resetLoginCaptcha = () => {
        loginCaptchaRef.current?.reset();
        setValue("captchaToken", "", { shouldValidate: true });
    };

    const onSubmitLogin = async (values: LoginFormValues) => {
        setLoginError(null);

        if (cooldownUntil && Date.now() < cooldownUntil) {
            const seconds = Math.max(
                1,
                Math.ceil((cooldownUntil - Date.now()) / 1000),
            );
            setLoginError(`Too many attempts. Try again in ${seconds}s.`);
            return;
        }

        const email = values.email.trim();

        // Server-side rate limit gate (best-effort). Note: this mainly protects abuse via the UI.
        try {
            const guardRes = await fetch("/api/auth/login-guard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, action: "check" }),
            });

            if (guardRes.status === 429) {
                const data = await guardRes.json().catch(() => null);
                const retryAfterSeconds =
                    data?.retryAfterSeconds ??
                    Number(guardRes.headers.get("Retry-After")) ??
                    60;
                setCooldownUntil(Date.now() + retryAfterSeconds * 1000);
                setLoginError(
                    `Too many attempts. Try again in ${retryAfterSeconds}s.`,
                );
                return;
            }
        } catch {
            // If guard fails, don't block login (avoid locking out users due to transient server issues)
        }

        const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
                email,
                password: values.password,
                options: {
                    captchaToken: values.captchaToken,
                },
            });

        if (signInError) {
            setLoginError(
                signInError.message || "Login failed. Please try again.",
            );
            resetLoginCaptcha();

            const nextFailCount = failCount + 1;
            setFailCount(nextFailCount);
            // Exponential backoff (client-side)
            const backoffSeconds = Math.min(
                30,
                Math.pow(2, Math.min(5, nextFailCount)),
            );
            setCooldownUntil(Date.now() + backoffSeconds * 1000);

            // Record failure in server-side guard
            fetch("/api/auth/login-guard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, action: "fail" }),
            }).catch(() => {});
            return;
        }

        const session = signInData.session;
        const accessToken = session?.access_token;

        if (!accessToken) {
            setLoginError("No access token found.");
            return;
        }

        // Restore previous client session persistence behavior
        localStorage.setItem("user_id", session.user.id);
        localStorage.setItem("access_token", accessToken);

        // Successful login: clear local cooldown and reset server-side counter
        setFailCount(0);
        setCooldownUntil(null);
        resetLoginCaptcha();
        fetch("/api/auth/login-guard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, action: "success" }),
        }).catch(() => {});
        onClose();
        router.refresh();
    };

    const handleForgotPassword = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();
        setForgotMessage(null);
        setForgotError(null);

        if (!forgotCaptchaToken) {
            setForgotError("Please complete the captcha.");
            return;
        }

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: forgotEmail,
                    captchaToken: forgotCaptchaToken,
                }),
            });

            if (res.status === 429) {
                const data = await res.json().catch(() => null);
                const retryAfterSeconds =
                    data?.retryAfterSeconds ??
                    Number(res.headers.get("Retry-After")) ??
                    60;
                setForgotError(
                    `Too many reset requests. Try again in ${retryAfterSeconds}s.`,
                );
                return;
            }

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setForgotError(
                    data?.error ??
                        "Failed to send reset email. Please try again.",
                );
                forgotCaptchaRef.current?.reset();
                setForgotCaptchaToken(null);
                return;
            }

            setForgotMessage(
                "Password reset email sent! Please check your inbox.",
            );
            forgotCaptchaRef.current?.reset();
            setForgotCaptchaToken(null);
        } catch {
            setForgotError("Failed to send reset email. Please try again.");
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-30"
            onClick={handleOverlayClick}
        >
            <div
                className="relative flex flex-row bg-white rounded-lg shadow-lg w-full md:w-fit h-full md:h-fit p-10"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="absolute flex cursor-pointer items-center justify-center top-5 right-5 w-10 h-10"
                    onClick={onClose}
                >
                    <X className="text-[#240C03] font-bold" />
                </button>
                <div className="hidden md:flex items-center">
                    <Image
                        className="object-fit h-80 w-80"
                        src="/assets/login.png"
                        alt="Login"
                        width={450}
                        height={450}
                    />
                </div>
                <div className="flex flex-col items-center md:items-start px-6 w-96 relative min-h-[420px]">
                    {/* Animated Login Form */}
                    <div
                        className={`${animationBase} ${
                            state === "login"
                                ? animationVisible
                                : animationHidden
                        }`}
                        aria-hidden={state !== "login"}
                    >
                        <h2 className="font-bold text-3xl text-[#240C03]">
                            Welcome Back!
                        </h2>
                        <p className="font-light py-2 text-sm text-[#240C03] border-b-2 border-[#E19517]">
                            We are thrilled to have you back. Login into your
                            account by inputting your email and password.
                        </p>
                        <form
                            onSubmit={handleSubmit(onSubmitLogin)}
                            className="space-y-4 mt-10 w-full"
                        >
                            {loginError && (
                                <p className="text-red-500">{loginError}</p>
                            )}
                            <div>
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
                                    className={`w-full px-4 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 ${
                                        errors.email
                                            ? "border-red-500 focus:ring-red-500"
                                            : "focus:ring-[#E19517] border-gray-400"
                                    }`}
                                />
                                {errors.email && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.email.message}
                                    </p>
                                )}
                            </div>
                            <div className="mb-5">
                                <div className="flex justify-between">
                                    <label
                                        htmlFor="password"
                                        className="block text-sm font-medium text-[#240C03]"
                                    >
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        className="text-[#E19517] hover:underline text-sm bg-transparent border-none p-0 cursor-pointer"
                                        onClick={() => setState("forgot")}
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    {...register("password")}
                                    className={`w-full px-4 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 ${
                                        errors.password
                                            ? "border-red-500 focus:ring-red-500"
                                            : "focus:ring-[#E19517] border-gray-400"
                                    }`}
                                />
                                {errors.password && (
                                    <p className="text-xs text-red-500 mt-1">
                                        {errors.password.message}
                                    </p>
                                )}
                                <div className="flex items-center mt-3">
                                    <input
                                        type="checkbox"
                                        id="showPassword"
                                        checked={showPassword}
                                        onChange={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        className="mr-2 accent-[#E19517] scale-120"
                                    />
                                    <label
                                        htmlFor="showPassword"
                                        className="text-sm text-[#240C03]"
                                    >
                                        Show Password
                                    </label>
                                </div>
                            </div>
                            <input
                                type="hidden"
                                {...register("captchaToken")}
                            />
                            <div
                                className={
                                    errors.captchaToken
                                        ? "rounded-md ring-2 ring-red-500"
                                        : ""
                                }
                            >
                                <HCaptchaWidget
                                    ref={loginCaptchaRef}
                                    onTokenChange={(token) => {
                                        setValue("captchaToken", token ?? "", {
                                            shouldValidate: true,
                                        });
                                        if (token) {
                                            clearErrors("captchaToken");
                                        }
                                    }}
                                    className="w-full"
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
                                {isSubmitting ? "Logging in..." : "Login"}
                            </button>
                            <p className="text-sm text-center text-gray-600">
                                Don&apos;t have an account?{" "}
                                <a
                                    onClick={onSwitchToSignUp}
                                    className="text-[#E19517] hover:underline cursor-pointer"
                                >
                                    Sign up
                                </a>
                            </p>
                        </form>
                    </div>
                    {/* Animated Forgot Password Form */}
                    <div
                        className={`${animationBase} ${
                            state === "forgot"
                                ? animationVisible
                                : animationHidden
                        }`}
                        aria-hidden={state !== "forgot"}
                    >
                        <h2 className="font-bold text-3xl text-[#240C03]">
                            Forgot Password
                        </h2>
                        <p className="font-light py-2 text-sm text-[#240C03] border-b-2 border-[#E19517]">
                            Enter your email address and we&apos;ll send you a
                            link to reset your password.
                        </p>
                        <form
                            onSubmit={handleForgotPassword}
                            className="space-y-4 w-full"
                        >
                            {forgotMessage || forgotError ? (
                                <p
                                    className={`${
                                        forgotMessage
                                            ? "text-[#E19517]"
                                            : "text-red-500"
                                    } h-5 mt-3 mb-5 text-sm`}
                                >
                                    {forgotMessage
                                        ? forgotMessage
                                        : forgotError}
                                </p>
                            ) : (
                                <div className="text-white h-10">.</div>
                            )}
                            <div>
                                <label
                                    htmlFor="forgotEmail"
                                    className="block text-sm font-medium text-[#240C03]"
                                >
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    id="forgotEmail"
                                    name="forgotEmail"
                                    required
                                    value={forgotEmail}
                                    onChange={(e) =>
                                        setForgotEmail(e.target.value)
                                    }
                                    className="w-full px-4 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#E19517] border-gray-400"
                                />
                            </div>
                            <HCaptchaWidget
                                ref={forgotCaptchaRef}
                                onTokenChange={setForgotCaptchaToken}
                                className="w-full"
                            />
                            <button
                                type="submit"
                                className="w-full px-4 py-2 text-white bg-[#E19517] rounded-md hover:bg-[#E19517]/90 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                                Send Reset Link
                            </button>
                            <button
                                type="button"
                                className="w-full px-4 py-2 text-[#240C03] bg-transparent border border-[#E19517] rounded-md hover:bg-[#E19517]/10 cursor-pointer focus:outline-none"
                                onClick={() => setState("login")}
                            >
                                Back to Login
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
