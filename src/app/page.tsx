"use client";

import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider"
import HomeContent from "@/components/home-content";

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        forcedTheme="light"
        disableTransitionOnChange
      >
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        }>
          <HomeContent />
        </Suspense>
      </ThemeProvider>
    </div>
  );
}