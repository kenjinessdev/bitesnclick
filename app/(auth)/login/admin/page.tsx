"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginAdmin } from "./actions";

const adminLoginSchema = z.object({
    username: z
        .string()
        .min(3, "Username must be at least 3 characters.")
        .max(30, "Username is too long.")
        .regex(/^[a-zA-Z0-9_]+$/, "Username contains invalid characters."),
    password: z
        .string()
        .min(1, "Password is required.")
        .max(100, "Password is too long."),
});

type AdminLoginFormValues = z.infer<typeof adminLoginSchema>;

export default function AuthComponent() {
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [lockUntil, setLockUntil] = useState<Date | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);

    const customColor = "#523923";

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<AdminLoginFormValues>({
        resolver: zodResolver(adminLoginSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    useEffect(() => {
        if (!lockUntil) return;

        const interval = setInterval(() => {
            const diff = Math.ceil((lockUntil.getTime() - Date.now()) / 1000);

            if (diff <= 0) {
                setLockUntil(null);
                setSecondsLeft(0);
                clearInterval(interval);
            } else {
                setSecondsLeft(diff);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [lockUntil]);

    const onSubmit = async (values: AdminLoginFormValues) => {
        setError("");

        const result = await loginAdmin(values.username, values.password);

        if (result?.error) {
            setError(result.error);

            if (result.lockSeconds) {
                const lockTime = new Date(
                    Date.now() + result.lockSeconds * 1000,
                );
                setLockUntil(lockTime);
                setSecondsLeft(result.lockSeconds);
            }

            return;
        }
    };

    const isLocked = !!lockUntil && lockUntil.getTime() > Date.now();

    return (
        <div className="min-h-screen flex">
            <div className="w-1/2 h-screen relative">
                <img
                    src="/assets/admin-bg.jpg"
                    className="absolute inset-0 w-full h-full object-cover"
                />
            </div>

            <div className="w-1/2 flex items-center justify-center bg-white/90">
                <div className="bg-white/80 p-8 rounded-2xl w-[544px] h-[544px] flex flex-col justify-center">
                    <div className="text-center mb-2">
                        <img src="/assets/hbd-logo.png" className="mx-auto" />
                    </div>

                    <h2
                        className="text-xl font-semibold text-center"
                        style={{ color: customColor }}
                    >
                        Admin Login
                    </h2>

                    {error && (
                        <p className="text-red-500 text-sm text-center">
                            {error}
                        </p>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
                        <div className="mb-3">
                            <label className="block mb-1">Username</label>
                            <input
                                {...register("username")}
                                className={`w-full p-2 border rounded ${
                                    errors.username
                                        ? "border-red-500"
                                        : "border-gray-300"
                                }`}
                            />
                            {errors.username && (
                                <p className="text-xs text-red-500 mt-1">
                                    {errors.username.message}
                                </p>
                            )}
                        </div>

                        <div className="mt-3">
                            <label className="block mb-1">Password</label>

                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    {...register("password")}
                                    className={`w-full p-2 border rounded ${
                                        errors.password
                                            ? "border-red-500"
                                            : "border-gray-300"
                                    }`}
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-2 top-2"
                                >
                                    {showPassword ? (
                                        <EyeOff size={18} />
                                    ) : (
                                        <Eye size={18} />
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-xs text-red-500 mt-1">
                                    {errors.password.message}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLocked || isSubmitting}
                            className={`w-full mt-5 py-2 rounded text-white ${
                                isLocked ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            style={{ backgroundColor: customColor }}
                        >
                            {isLocked
                                ? `Locked (${secondsLeft}s)`
                                : isSubmitting
                                  ? "Logging in..."
                                  : "Login"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
