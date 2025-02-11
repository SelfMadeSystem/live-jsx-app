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

## License

Distributed under the MIT License. See `LICENSE` for more information.
