import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle";

const chat = () => {
    return (
        <div className=" container relative flex flex-col min-h-screen">
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange={false}
            >
                <div className="backdrop-blur-md supports-backdrop-blur:bg-background flex items-center justify-between p-4">

                    <span className="font-bold">Trivandum Chat</span>
                    <ModeToggle />
                </div>



            </ThemeProvider >
        </div >
    )
}

export default chat