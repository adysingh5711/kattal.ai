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
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]  hide-scrollbar h-screen">
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <div className="top-6 right-6 absolute z-50">
          <ModeToggle />
        </div>

        <div className="absolute z-0 w-full h-screen">
          {/* SoundWave Overlap */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-[85%] sm:mt-[28%] overflow-clip z-20">
            <SoundWaveAnimation />
          </div>
          {/* Overlay Box to Improve Readability */}
          <div className="absolute inset-0 bg-black"></div>
          <Image
            src="/Trivandrum.jpg"
            alt="Trivandrum"
            fill
            className="opacity-60 dark:opacity-40 z-0 object-cover"
            priority
          />

        </div>


        <main className="flex flex-col gap-[36px] row-start-2 items-center z-10">
          <div className="text-center">
            <Balancer>
              <SplitText
                text="Know Your District,"
                className="sm:text-6xl inline text-4xl font-bold text-center text-white"
                onLetterAnimationComplete={() => { }}
              />
              <SplitText
                text="Instantly"
                className={`${pacifico.className} text-center inline text-4xl font-bold sm:text-6xl`}
                splitType="words"
                wordClassName="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-indigo-400 to-sky-300 dark:from-indigo-400 via-white/90 to-rose-400"
                onLetterAnimationComplete={() => { }}
              />
            </Balancer>
          </div>
          <Balancer>
            <WordReveal
              text="Understand development, services, and statistics through natural conversation."
              className={`${playfair.className} text-center italic text-yellow-300 text-lg leading-relaxed z-100`}
            />
          </Balancer>

          <div className="sm:flex-row flex flex-col items-center gap-4">
            <a
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm z-10 sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
              href="/chat"
              target=""
              rel="noopener noreferrer"
            >
              Start Chatting
            </a>
            {/* <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a> */}
          </div>
        </main>
        {/* <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="hover:underline hover:underline-offset-4 flex items-center gap-2"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="hover:underline hover:underline-offset-4 flex items-center gap-2"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="hover:underline hover:underline-offset-4 flex items-center gap-2"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer> */}
      </ThemeProvider>
    </div >
  );
}
