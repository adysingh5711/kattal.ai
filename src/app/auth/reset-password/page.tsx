"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, Lock } from "lucide-react";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => router.push('/'), 3000);
            } else {
                setError(data.error || "Failed to reset password");
            }
        } catch (err) {
            console.error('Reset password error:', err);
            setError("Network error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white">
                        Reset Password
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                        Enter your new password below
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success ? (
                        <div className="space-y-4">
                            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <AlertDescription className="text-green-800 dark:text-green-200">
                                    Your password has been reset successfully! Redirecting to sign in...
                                </AlertDescription>
                            </Alert>
                            <Button
                                onClick={() => router.push('/')}
                                className="w-full rounded-xl"
                                variant="outline"
                            >
                                Go to Sign In
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-password" className="text-sm font-medium text-foreground">
                                    New Password
                                </Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (error) setError(null);
                                    }}
                                    className="rounded-xl border-border focus:border-ring focus:ring-ring/20 transition-all duration-200"
                                    required
                                    autoComplete="new-password"
                                    minLength={6}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-new-password" className="text-sm font-medium text-foreground">
                                    Confirm New Password
                                </Label>
                                <Input
                                    id="confirm-new-password"
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        if (error) setError(null);
                                    }}
                                    className="rounded-xl border-border focus:border-ring focus:ring-ring/20 transition-all duration-200"
                                    required
                                    autoComplete="new-password"
                                    minLength={6}
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 text-base shadow-lg hover:shadow-xl transition-all duration-200 focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Resetting Password...
                                    </>
                                ) : (
                                    "Reset Password"
                                )}
                            </Button>

                            <Button
                                type="button"
                                onClick={() => router.push('/')}
                                variant="ghost"
                                className="w-full text-sm text-muted-foreground hover:text-foreground"
                            >
                                Back to Sign In
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
