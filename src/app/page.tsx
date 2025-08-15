"use client";

import Image from "next/image";
import { pacifico, playfair } from "./font";
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "motion/react";

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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  const imageVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.8 }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeProvider
        attribute="class"
        disableTransitionOnChange
      >
        <motion.div
          className="absolute top-6 right-6 z-50"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <ModeToggle />
        </motion.div>

        <div className="container mx-auto px-4 py-8">
          <motion.div
            className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-4rem)]"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Left Side - Image and Branding */}
            <motion.div
              className="flex flex-col items-center justify-center text-center space-y-8"
              variants={itemVariants}
            >
              <motion.div
                className="relative w-full max-w-md"
                variants={imageVariants}
              >
                <Image
                  src="/BanyanTree.png"
                  alt="Banyan Tree - District Knowledge"
                  width={400}
                  height={300}
                  className="w-full h-auto object-contain"
                  priority
                />
              </motion.div>

              <motion.div
                className="space-y-4"
                variants={itemVariants}
              >
                <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
                  <span className="block">Know Your District,</span>
                  <span className={`${pacifico.className} bg-gradient-to-r from-primary via-accent to-chart-2 bg-clip-text text-transparent`}>
                    Instantly
                  </span>
                </h1>

                <p className={`${playfair.className} text-lg text-muted-foreground italic max-w-md mx-auto leading-relaxed`}>
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
                whileHover={{
                  scale: 1.01,
                  transition: { duration: 0.2 }
                }}
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

                      <TabsContent value="signup" className="space-y-4 mt-6">
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
                      </TabsContent>

                      <TabsContent value="signin" className="space-y-4 mt-6">
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
                      </TabsContent>
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
