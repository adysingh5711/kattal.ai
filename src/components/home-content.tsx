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
import { AlertCircle, Loader2, Mail, Lock, MessageSquare } from "lucide-react";

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

        // Check for authentication errors from OAuth flow
        const authError = searchParams.get('auth_error');
        if (authError) {
            setError(`Authentication failed: ${decodeURIComponent(authError)}`);
            // Clear the URL parameter after showing the error
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('auth_error');
            window.history.replaceState({}, '', newUrl.toString());
        }

        // Check for authentication code (this shouldn't happen if callback is working)
        const code = searchParams.get('code');
        if (code) {
            console.log('Received auth code on home page:', code);
            setError("Authentication code received but not processed. Please try signing in again.");
            // Clear the URL parameter
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('code');
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
        <div className="min-h-screen flex flex-col">
            <main className="flex-grow container mx-auto px-4 py-4 flex flex-col justify-center">
                <motion.div
                    className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mb-2"
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
                                width={300}
                                height={225}
                                className="w-full h-auto object-contain max-h-[350px]"
                                priority
                            />
                        </motion.div>

                        <motion.div
                            className="space-y-4 z-10 relative"
                            variants={itemVariants}
                        >
                            <h1 className="text-3xl lg:text-4xl font-bold text-foreground transition-all duration-300 group-hover:text-primary/90">
                                <span className="block">Know Our Kattakkada,</span>
                                <span className={`${pacifico.className} bg-gradient-to-r from-primary via-accent to-chart-2 bg-clip-text text-transparent transition-all duration-300 group-hover:from-primary/80 group-hover:via-accent/80 group-hover:to-chart-2/80`}>
                                    Instantly
                                </span>
                            </h1>

                            <p className={`${playfair.className} text-base text-muted-foreground italic max-w-md mx-auto leading-relaxed transition-all duration-300 group-hover:text-foreground/80`}>
                                Understand development, services, and statistics through natural conversation.
                            </p>
                        </motion.div>

                        {/* Important Links Section */}
                        <motion.div
                            variants={itemVariants}
                            className="w-full max-w-md mx-auto pt-2"
                        >
                            <div className="grid grid-cols-3 gap-2">
                                <a
                                    href="https://jalasamrdhi.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-card/50 hover:bg-muted/50 transition-colors p-2 rounded-lg border shadow-sm flex flex-col items-center text-center group h-full justify-center"
                                >
                                    <h3 className="font-semibold text-xs group-hover:text-primary transition-colors leading-tight">ജലസമൃദ്ധി</h3>
                                </a>
                                <a
                                    href="https://kattakadalac.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-card/50 hover:bg-muted/50 transition-colors p-2 rounded-lg border shadow-sm flex flex-col items-center text-center group h-full justify-center"
                                >
                                    <h3 className="font-semibold text-xs group-hover:text-primary transition-colors leading-tight">അറിയാം കാട്ടാക്കട</h3>
                                </a>
                                <a
                                    href="https://kidc.co.in"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-card/50 hover:bg-muted/50 transition-colors p-2 rounded-lg border shadow-sm flex flex-col items-center text-center group h-full justify-center"
                                >
                                    <h3 className="font-semibold text-xs group-hover:text-primary transition-colors leading-tight">KIDC</h3>
                                </a>
                            </div>
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
                            <Card className="w-full max-w-lg mx-auto p-6 shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl">
                                <CardHeader className="text-center space-y-2">
                                    <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white">
                                        Welcome Back!
                                    </CardTitle>
                                    <CardDescription className="text-gray-600 dark:text-gray-400">
                                        Please login to get started
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

                                    <Tabs defaultValue="signin" className="w-full">
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
                                                                autoComplete="name"
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
                                                                autoComplete="email"
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
                                                                autoComplete="new-password"
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
                                                                autoComplete="new-password"
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
                                                                autoComplete="email"
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
                                                                autoComplete="current-password"
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


            </main>

            {/* Footer */}
            <footer className="w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 order-2 md:order-1">
                            <a href="https://facebook.com/ibsathishonline" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                                <Image src="/facebook-icon.svg" alt="Facebook" width={20} height={20} className="dark:invert" />
                            </a>
                            <a href="https://instagram.com/ibsathishonline" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                                <Image src="/instagram-icon.svg" alt="Instagram" width={20} height={20} className="dark:invert" />
                            </a>
                            <a href="https://x.com/ibsathishonlinee" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                                <Image src="/x-icon.svg" alt="X (Twitter)" width={20} height={20} className="dark:invert" />
                            </a>
                            <a href="https://youtube.com/@ibsathishonline" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                                <Image src="/youtube-icon.svg" alt="YouTube" width={20} height={20} className="dark:invert" />
                            </a>
                        </div>

                        <div className="order-1 md:order-2">
                            <a
                                href="https://forms.gle/14DUEJ1AA3Lonpm66"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <MessageSquare className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                                <span className="group-hover:underline decoration-border/50 underline-offset-4">Give Feedback</span>
                            </a>
                        </div>

                        <div className="text-center md:text-right text-xs text-muted-foreground order-3">
                            <p>An initiative by IB Satheesh, MLA | Developed by PACE</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
