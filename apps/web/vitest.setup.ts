import '@testing-library/jest-dom';
import React from 'react';

// Vitest/jsdom may not inject the classic JSX runtime; ensure React is in scope.
(globalThis as typeof globalThis & { React: typeof React }).React = React;
