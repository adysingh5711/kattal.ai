"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AuthCodeErrorPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold text-destructive">
                        Authentication Error
                    </CardTitle>
                    <CardDescription>
                        There was a problem with your authentication
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Authentication Failed</AlertTitle>
                        <AlertDescription>
                            The authentication code was invalid or has expired. This could happen if:
                            <ul className="mt-2 list-disc list-inside space-y-1">
                                <li>The link has expired</li>
                                <li>The link has already been used</li>
                                <li>There was a network error</li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <Button
                            onClick={() => router.push('/')}
                            className="w-full"
                            variant="default"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Try Again
                        </Button>
                        <Button
                            onClick={() => router.push('/chat')}
                            variant="outline"
                            className="w-full"
                        >
                            Continue as Guest
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
