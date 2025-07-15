// app/fonts.ts
import { Roboto, Playfair_Display, Hurricane, Pacifico } from 'next/font/google';

export const roboto = Roboto({ subsets: ['latin'], weight: ['400', '700'] });
export const playfair = Playfair_Display({ subsets: ['latin'], weight: '400' });
export const hurricane = Hurricane({ weight: '400', subsets: ['latin'] });
export const pacifico = Pacifico({ weight: '400', subsets: ['latin'], variable: "--font-pacifico" });