module.exports = {
    theme: {
        extend: {
            fontFamily: {
                Hurricane: ['"Hurricane"', 'cursive'],
            },
        },
        animation: {
            'bg-shimmer': 'shimmer 3s linear infinite',
        },
        keyframes: {
            shimmer: {
                '0%': { backgroundPosition: '0% 50%' },
                '100%': { backgroundPosition: '100% 50%' },
            },
        },
    },
    plugins: [
        function ({ addUtilities }) {
            addUtilities({
                '.hide-scrollbar': {
                    'scrollbar-width': 'none', // Firefox
                    '-ms-overflow-style': 'none', // IE/Edge
                },
                '.hide-scrollbar::-webkit-scrollbar': {
                    display: 'none', // Chrome, Safari, Opera
                },
            });
        },
    ],
};
