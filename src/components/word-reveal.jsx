// components/WordReveal.jsx
import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";

const WordReveal = ({ text, className = "" }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        const words = gsap.utils.toArray(".reveal-word", containerRef.current);
        gsap.from(words, {
            opacity: 0,
            y: 10,
            stagger: 0.1,
            duration: 0.6,
            ease: "power2.out"
        });
    }, []);

    return (
        <h2
            ref={containerRef}
            className={`flex flex-wrap justify-center text-center italic ${className}`}
        >
            {text.split(" ").map((word, index) => (
                <span key={index} className="reveal-word whitespace-nowrap mr-1">
                    {word}
                </span>
            ))}
        </h2>
    );
};

export default WordReveal;
