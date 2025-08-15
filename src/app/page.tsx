"use client";

import Image from "next/image";
import { pacifico, playfair } from "./font";
import { ThemeProvider } from "@/components/theme-provider"
// import { UserDropdown } from "@/components/user-dropdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function Home() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle signup logic here
    console.log('Sign up:', formData);
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle signin logic here
    console.log('Sign in:', { email: formData.email, password: formData.password });
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
    <div className="min-h-screen bg-background relative overflow-hidden">




      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        forcedTheme="light"
        disableTransitionOnChange
      >
        {/* User dropdown removed - will be added to layout.tsx */}

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
              {/* Glowing Border Effect - Performance Optimized
              <div className="absolute inset-0 rounded-3xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div> */}

              <motion.div
                className="relative w-full max-w-md z-10"
                variants={imageVariants}
              >
                <Image
                  src="/kaattal.png"
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

                      <AnimatePresence mode="wait">
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
                                className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 text-base shadow-lg hover:shadow-xl transition-all duration-200 focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              >
                                Create Account
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
                                className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 text-base shadow-lg hover:shadow-xl transition-all duration-200 focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              >
                                Sign In
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
      </ThemeProvider>
    </div>
  );
}
