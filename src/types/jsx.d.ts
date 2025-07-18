import * as React from 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            // Using a more flexible type that allows any properties
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [elemName: string]: any;
        }
    }
}

// This ensures React is used
const _React: typeof React = React;