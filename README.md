# Live JSX App

This project is a live JSX editor built with Vite, React, TypeScript, and TailwindCSS. It allows you to write and preview JSX and CSS code in real-time using the Monaco Editor.

## Getting Started

### Prerequisites

- [bun](https://bun.sh/)
- A brain

### Installation

1. Clone the repository:

```sh
git clone https://github.com/your-username/live-jsx-app.git
cd live-jsx-app
```

2. Install the dependencies:

```sh
bun i
```

3. Start the development server:

```sh
bun dev
```

4. Open your browser and navigate to `http://localhost:5173` or type `o` in the terminal with the development server running.

## How does it work?

The app uses the Monaco Editor to allow you to write JSX and CSS code. The code is then transpiled using [SWC](https://swc.rs/) and [PostCSS](https://postcss.org/) with [TailwindCSS](https://tailwindcss.com/) to generate the preview. I made a custom Monaco TailwindCSS integration because, at the time of writing, [monaco-tailwindcss](https://github.com/remcohaszing/monaco-tailwindcss) [does not support TailwindCSS v4](https://github.com/remcohaszing/monaco-tailwindcss/issues/96). Getting it to support both TailwindCSS v3 and v4 will be annoying and is outside the scope of this project.

### Additional Features

- **Multi-file Support**: The app supports multiple files by creating a dependency graph and recursively resolving imports. It replaces imports with object URLs to enable seamless file linking.
- **NPM Package Support**: You can import almost any package from NPM that supports the browser using [Skypack](https://www.skypack.dev/). This includes TypeScript support, as the app automatically downloads type definitions and integrates them into monaco's type checker.
- **TailwindCSS Support**: The app uses TailwindCSS for styling. You can use any TailwindCSS class in your JSX code, and the app will automatically generate the corresponding CSS. Since this projects supports TailwindCSS v4, you can use the new CSS specific features like `@theme` and `@layer`. You may also opt out of using TailwindCSS by just not using it. If you include any `@import` statements in your CSS, the app will disable automatic TailwindCSS generation unless you specifically `@import "tailwindcss"`.
- **CSS class autocompletion**: The app provides autocompletion for classes when writing CSS. It finds all the classes used in the JSX code and prompts them as suggestions in the CSS editor.

## License

Distributed under the MIT License. See `LICENSE` for more information.
