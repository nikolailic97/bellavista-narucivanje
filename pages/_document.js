import { Html, Head, Main, NextScript } from "next/document";

// lang="sr" je bitan za Lighthouse Accessibility i SEO (osnovni jezik sajta
// je srpski — kupac može da prebaci meni/korpu/tracking na engleski preko
// toggle-a u headeru, ali interni panel i osnovna struktura ostaju na srpskom).
export default function Document() {
  return (
    <Html lang="sr">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
