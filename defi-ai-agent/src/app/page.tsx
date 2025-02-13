// app/page.tsx
"use client";

import { WagmiProvider } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import AIAgent from "@/components/AIAgent";
import {  getDefaultConfig, lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "RainbowKit demo",
  projectId: "6780ea76605adb8e2893655e41c392a3",
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(),
  },
});

const queryClient = new QueryClient();

export default function Home() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme({accentColor:"#331931"})} modalSize="wide">
          <AIAgent />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
