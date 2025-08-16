"use client";

import Image from "next/image";
import { pacifico, playfair } from "../app/font";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Mail, Lock } from "lucide-react";

export default function HomeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);

    // Check for authentication error from URL parameters
    useEffect(() => {
        if (searchParams.get('auth_required') === 'true') {
            setAuthError("Please sign in or create an account to access the chat feature.");
            // Clear the URL parameter after showing the error
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('auth_required');
            window.history.replaceState({}, '', newUrl.toString());
        }
    }, [searchParams]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear errors when user starts typing
        if (error) setError(null);
        if (success) setSuccess(null);
        if (authError) setAuthError(null);
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        // Validate password strength
        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters long");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    name: formData.name,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                if (data.needsEmailConfirmation) {
                    setSuccess("Please check your email to confirm your account before signing in.");
                } else {
                    setSuccess("Account created successfully! Redirecting...");
                    setTimeout(() => router.push('/chat'), 2000);
                }
            } else {
                setError(data.error || "Failed to create account");
            }
        } catch (err) {
            console.error('Sign up error:', err);
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess("Signed in successfully! Redirecting...");
                setTimeout(() => router.push('/chat'), 1000);
            } else {
                setError(data.error || "Failed to sign in");
            }
        } catch (err) {
            console.error('Sign in error:', err);
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        try {
            // This will redirect to Google OAuth
            window.location.href = '/api/auth/google';
        } catch (err) {
            console.error('Google sign in error:', err);
            setError("Failed to initiate Google sign in");
            setLoading(false);
        }
    };

    // Animation variants - Simplified for performance
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                duration: 0.4,
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4 }
        }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.3 }
        }
    };

    const imageVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { duration: 0.5 }
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <motion.div
                className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-4rem)]"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Left Side - Image and Branding */}
                <motion.div
                    className="flex flex-col items-center justify-center text-center space-y-8 relative group"
                    variants={itemVariants}
                >
                    <motion.div
                        className="relative w-full max-w-md z-10"
                        variants={imageVariants}
                    >
                        <Image
                            src="/kattal.png"
                            alt="Banyan Tree - District Knowledge"
                            width={400}
                            height={300}
                            className="w-full h-auto object-contain"
                            priority
                        />
                    </motion.div>

                    <motion.div
                        className="space-y-4 z-10 relative"
                        variants={itemVariants}
                    >
                        <h1 className="text-4xl lg:text-5xl font-bold text-foreground transition-all duration-300 group-hover:text-primary/90">
                            <span className="block">Know Your District,</span>
                            <span className={`${pacifico.className} bg-gradient-to-r from-primary via-accent to-chart-2 bg-clip-text text-transparent transition-all duration-300 group-hover:from-primary/80 group-hover:via-accent/80 group-hover:to-chart-2/80`}>
                                Instantly
                            </span>
                        </h1>

                        <p className={`${playfair.className} text-lg text-muted-foreground italic max-w-md mx-auto leading-relaxed transition-all duration-300 group-hover:text-foreground/80`}>
                            Understand development, services, and statistics through natural conversation.
                        </p>
                    </motion.div>
                </motion.div>

                {/* Right Side - Sign Up/Login Forms */}
                <motion.div
                    className="flex items-center justify-center w-full"
                    variants={itemVariants}
                >
                    <motion.div
                        variants={cardVariants}
                        className="w-full"
                    >
                        <Card className="w-full max-w-lg p-6 shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl">
                            <CardHeader className="text-center space-y-2">
                                <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white">
                                    Welcome Back
                                </CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400">
                                    Choose your option to get started
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                {/* Authentication Required Error */}
                                {authError && (
                                    <Alert variant="destructive" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                                        <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                        <AlertDescription className="text-amber-800 dark:text-amber-200">
                                            {authError}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Error/Success Messages */}
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}
                                {success && (
                                    <Alert>
                                        <Mail className="h-4 w-4" />
                                        <AlertDescription>{success}</AlertDescription>
                                    </Alert>
                                )}

                                {/* Google Sign In Button */}
                                <Button
                                    onClick={handleGoogleSignIn}
                                    disabled={loading}
                                    variant="outline"
                                    className="w-full h-12 text-base"
                                >
                                    {loading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            />
                                        </svg>
                                    )}
                                    Continue with Google
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">
                                            Or continue with email
                                        </span>
                                    </div>
                                </div>

                                <Tabs defaultValue="signup" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-xl">
                                        <TabsTrigger
                                            value="signup"
                                            className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all duration-200"
                                        >
                                            Sign Up
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="signin"
                                            className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all duration-200"
                                        >
                                            Sign In
                                        </TabsTrigger>
                                    </TabsList>

                                    <AnimatePresence mode="sync">
                                        <TabsContent value="signup" className="space-y-4 mt-6" key="signup">
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                            >
                                                <form onSubmit={handleSignUp} className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="name" className="text-sm font-medium text-foreground">
                                                            Full Name
                                                        </Label>
                                                        <Input
                                                            id="name"
                                                            name="name"
                                                            type="text"
                                                            placeholder="Enter your full name"
                                                            value={formData.name}
                                                            onChange={handleInputChange}
                                                            className="rounded-xl border-border focus:border-ring focus:ring-ring/20 transition-all duration-200"
                                                            required
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="email" className="text-sm font-medium text-foreground">
                                                            Email
                                                        </Label>
                                                        <Input
                                                            id="email"
                                                            name="email"
                                                            type="email"
                                                            placeholder="Enter your email"
                                                            value={formData.email}
                                                            onChange={handleInputChange}
                                                            className="rounded-xl border-border focus:border-ring focus:ring-ring/20 transition-all duration-200"
                                                            required
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="password" className="text-sm font-medium text-foreground">
                                                            Password
                                                        </Label>
                                                        <Input
                                                            id="password"
                                                            name="password"
                                                            type="password"
                                                            placeholder="Create a password"
                                                            value={formData.password}
                                                            onChange={handleInputChange}
                                                            className="rounded-xl border-border focus:border-ring focus:ring-ring/20 transition-all duration-200"
                                                            required
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                                                            Confirm Password
                                                        </Label>
                                                        <Input
                                                            id="confirmPassword"
                                                            name="confirmPassword"
                                                            type="password"
                                                            placeholder="Confirm your password"
                                                            value={formData.confirmPassword}
                                                            onChange={handleInputChange}
                                                            className="rounded-xl border-border focus:border-ring focus:ring-ring/20 transition-all duration-200"
                                                            required
                                                        />
                                                    </div>

                                                    <Button
                                                        type="submit"
                                                        disabled={loading}
                                                        className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 text-base shadow-lg hover:shadow-xl transition-all duration-200 focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {loading ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Creating Account...
                                                            </>
                                                        ) : (
                                                            "Create Account"
                                                        )}
                                                    </Button>
                                                </form>
                                            </motion.div>
                                        </TabsContent>

                                        <TabsContent value="signin" className="space-y-4 mt-6" key="signin">
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                            >
                                                <form onSubmit={handleSignIn} className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="signin-email" className="text-sm font-medium text-foreground">
                                                            Email
                                                        </Label>
                                                        <Input
                                                            id="signin-email"
                                                            name="email"
                                                            type="email"
                                                            placeholder="Enter your email"
                                                            value={formData.email}
                                                            onChange={handleInputChange}
                                                            className="rounded-xl border-border focus:border-ring focus:ring-ring/20 transition-all duration-200"
                                                            required
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="signin-password" className="text-sm font-medium text-foreground">
                                                            Password
                                                        </Label>
                                                        <Input
                                                            id="signin-password"
                                                            name="password"
                                                            type="password"
                                                            placeholder="Enter your password"
                                                            value={formData.password}
                                                            onChange={handleInputChange}
                                                            className="rounded-xl border-border focus:border-ring focus:ring-ring/20 transition-all duration-200"
                                                            required
                                                        />
                                                    </div>

                                                    <Button
                                                        type="submit"
                                                        disabled={loading}
                                                        className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 text-base shadow-lg hover:shadow-xl transition-all duration-200 focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {loading ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Signing In...
                                                            </>
                                                        ) : (
                                                            "Sign In"
                                                        )}
                                                    </Button>
                                                </form>
                                            </motion.div>
                                        </TabsContent>
                                    </AnimatePresence>
                                </Tabs>
                            </CardContent>
                        </Card>
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    );
}
