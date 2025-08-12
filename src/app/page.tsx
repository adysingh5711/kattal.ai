"use client";

import Image from "next/image";
import { pacifico, playfair } from "./font";
import SplitText from "@/components/split-text";
import WordReveal from "@/components/word-reveal";
import { SoundWaveAnimation } from '@/components/sound-wave-animation';
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle";
import Balancer from 'react-wrap-balancer';


export default function Home() {
  return (
    <div className="home-page grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]  hide-scrollbar h-screen">
      <ThemeProvider
        attribute="class"
        // defaultTheme="light"
        // enableSystem={false} // disable system preference
        forcedTheme="light"
        disableTransitionOnChange
      >
        {/* <div className="top-6 right-6 absolute z-50">
          <ModeToggle />
        </div> */}

        <div className="absolute z-0 w-full h-screen">
          {/* SoundWave Overlap */}
          {/* <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-[85%] sm:mt-[28%] overflow-clip z-20">
            <SoundWaveAnimation />
          </div> */}
          {/* Overlay Box to Improve Readability */}
          <div className="absolute inset-0 bg-transparent flex items-end justify-center">
            <Image
              src="/BanyanTree.png"
              alt="BanyanTree"
              width={1200}
              height={300}
              className="opacity-100 dark:opacity-40 z-0 object-cover"
              priority
            />
          </div>

        </div>


        <main className="flex flex-col gap-[36px] row-start-2 items-center z-10">
          <div className="home-text-primary text-center">
            <Balancer>
              <SplitText
                text="Know Your District,"
                className="sm:text-6xl inline text-4xl font-bold text-center text-white home-text-shadow"
                onLetterAnimationComplete={() => { }}
              />
              <SplitText
                text="Instantly"
                className={`${pacifico.className} text-center inline text-4xl font-bold sm:text-6xl`}
                splitType="words"
                wordClassName="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-violet-500 to-sky-400 dark:from-indigo-400 via-purple-200 to-rose-400"
                onLetterAnimationComplete={() => { }}
              />
            </Balancer>
          </div>
          <Balancer>
            <WordReveal
              text="Understand development, services, and statistics through natural conversation."
              className={`${playfair.className} text-center italic oklch(0.2 0.08 45) sm:text-yellow-300 text-lg leading-relaxed z-100`}
            />
          </Balancer>

          <div className="sm:flex-row flex flex-col items-center gap-4">
            <a
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-primary text-primary-foreground gap-2 hover:bg-primary/90 font-medium text-sm z-10 sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto shadow-lg hover:shadow-xl transition-all duration-200"
              href="/chat"
              target=""
              rel="noopener noreferrer"
            >
              Start Chatting
            </a>
          </div>
        </main>
      </ThemeProvider>
    </div >
  );
}
