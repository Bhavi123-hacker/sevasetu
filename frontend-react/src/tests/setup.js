import '@testing-library/jest-dom'

// jsdom doesn't implement this browser API; real browsers do.
global.URL.createObjectURL = global.URL.createObjectURL || (() => 'blob:mock-url')
