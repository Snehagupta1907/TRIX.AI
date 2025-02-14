"use client";
import React, { useState, KeyboardEvent } from "react";
import { useAccount } from "wagmi";
import {
  Loader,
  BrainCircuit,
  ArrowRightLeft,
  PiggyBank,
  LineChart,
  Send,
  Rocket,
  ImagePlay,
} from "lucide-react";
import ResponseDisplay from "./ResponseDisplay";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateImage } from "@/utils/img-gen";
import { formatNftPrompt } from "@/utils/prompt";

type TabType = "general" | "swap" | "lend" | "trade" | "mint";
type Chain = "arbitrum" | "optimism" | "base" | "ethereum";

export default function AIAgent() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      role: "user" | "assistant";
      content: string | React.JSX.Element | object;
    }>
  >([]);

  const [userInput, setUserInput] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [selectedChain, setSelectedChain] = useState<Chain>("arbitrum");
  const [error, setError] = useState("");
  // NEW: State to hold the NFT data waiting for confirmation
  const [pendingNFT, setPendingNFT] = useState<{ nftIpfsUrl: string } | null>(
    null
  );
  type SwapStep =
    | "SETUP_CONFIRMATION"
    | "AWAIT_DEPOSIT_APPROVAL"
    | "AWAIT_SWAP_DETAILS"
    | "CONFIRM_SWAP"
    | "AWAIT_AMOUNT"
    | "AWAIT_BUY_TOKEN"
    | "AWAIT_SELL_TOKEN"
    | "AWAIT_PRIVATE_KEY";

  interface SwapDetails {
    inputAmt?: string;
    sellAddress?: string;
    buyAddress?: string;
    sellToken?: string;
    buyToken?: string;
  }

  interface PendingSwap {
    step: SwapStep;
    details?: SwapDetails;
  }

  // State definitions
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [pendingSwap, setPendingSwap] = useState<PendingSwap | null>(null);

  const { isConnected, address } = useAccount();
  const [privateKey, setPrivateKey] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isConnected && activeTab !== "general") {
      setActiveTab("general");
    }
  }, [isConnected, activeTab]);

  // Helper function to check for confirmation phrases
  const isConfirmation = (text: string) => {
    const confirmations = [
      "yes",
      "sure",
      "why not",
      "go ahead",
      "mint",
      "confirm",
    ];
    return confirmations.some((phrase) => text.toLowerCase().includes(phrase));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim()) return;
    setError("");
    setLoading(true);

    // Append the user's message to the conversation
    const currentInput = userInput;
    setMessages((prev) => [...prev, { role: "user", content: currentInput }]);
    setUserInput("");

    try {
      let response;

      switch (activeTab) {
        case "mint":
          if (!address) {
            setError("Wallet must be connected to mint an NFT.");
            setLoading(false);
            return;
          }

          // If we already generated an NFT and are waiting for confirmation…
          if (pendingNFT) {
            if (isConfirmation(currentInput)) {
              // User confirmed; proceed with minting the NFT
              const requestBody = {
                WALLET_ADDRESS: address,
                TOKEN_URI: pendingNFT.nftIpfsUrl,
              };
              response = await fetch("/api/nft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
              });
              // Clear the pending NFT after minting
              setPendingNFT(null);
            } else {
              // No confirmation detected: cancel minting
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    "Minting cancelled. If you want to mint, please generate a new NFT image.",
                },
              ]);
              setPendingNFT(null);
              setLoading(false);
              return;
            }
          } else {
            // No pending NFT – generate the NFT image and ask for confirmation
            const tokenUri = await generateImage(formatNftPrompt(currentInput));
            console.log(tokenUri);
            if (tokenUri?.nftIpfsUrl) {
              setPendingNFT({ nftIpfsUrl: tokenUri.nftIpfsUrl });
            } else {
              setError("Error generating NFT image.");
              setLoading(false);
              return;
            }

            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: {
                  text: "Here is your generated image:",
                  imageSrc: tokenUri?.img, // Store the image URL separately
                },
              },
            ]);
            setLoading(false);
            return; // wait for the user's confirmation response
          }
          break;

        case "swap": {
          try {
            // New user without Safe - Initial interaction
            if (!privateKey) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    "To proceed with the swap, I'll need your private key. Please enter it now:",
                },
              ]);
              setPendingSwap({ step: "AWAIT_PRIVATE_KEY" });
              return;
            }

            // Handle private key input
            if (pendingSwap?.step === "AWAIT_PRIVATE_KEY") {
              const inputKey = currentInput.trim();

              // Basic validation - check if it's a valid hex string of appropriate length
              if (!/^0x[0-9a-fA-F]{64}$/.test(inputKey)) {
                throw new Error(
                  "Invalid private key format. Please provide a valid private key."
                );
              }

              setPrivateKey(inputKey);

              // Proceed to next step - check for Safe wallet
              if (!safeAddress) {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content:
                      "I notice you want to swap tokens! You'll need a Safe wallet first. Would you like me to set one up for you?",
                  },
                ]);
                setPendingSwap({ step: "SETUP_CONFIRMATION" });
                return;
              }
            }
            if (!safeAddress && !pendingSwap) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    "I notice you want to swap tokens! You'll need a Safe wallet first. Would you like me to set one up for you?",
                },
              ]);

              setPendingSwap({ step: "SETUP_CONFIRMATION" });
              return;
            }

            // User confirmed Safe setup
            if (
              !safeAddress &&
              pendingSwap?.step === "SETUP_CONFIRMATION" &&
              isConfirmation(currentInput)
            ) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: "Creating your Safe wallet now...",
                },
              ]);

              const safeResponse = await fetch("/api/setup-safe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  SIGNER_PRIVATE_KEY: privateKey,
                }),
              });

              if (safeResponse.status === 500) {
                const err = await safeResponse.json();
                console.log({ err });
                throw new Error(err?.details || "Error creating");
              }

              const { safeAddress: newSafeAddress } = await safeResponse.json();
              setSafeAddress(newSafeAddress);

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Great! I've created your Safe wallet at ${newSafeAddress}. Before we can swap, we need to deposit some ETH and approve it for trading. Should I proceed with that?`,
                },
              ]);

              setPendingSwap({ step: "AWAIT_DEPOSIT_APPROVAL" });
              return;
            }

            // User confirmed deposit and approve
            if (
              pendingSwap?.step === "AWAIT_DEPOSIT_APPROVAL" &&
              isConfirmation(currentInput)
            ) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: "Processing deposit and approval...",
                },
              ]);

              const approveResponse = await fetch("/api/deposit-approve-cow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  SAFE_ADDRESS: safeAddress,
                  SIGNER_PRIVATE_KEY: privateKey,
                }),
              });

              if (!approveResponse.ok)
                throw new Error("Failed to execute deposit and approval");

              const { transactionHash, wethBalance, ethBalance } =
                await approveResponse.json();

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Perfect! The deposit and approval are complete (tx: ${transactionHash}). Your balances are: ${ethBalance} ETH and ${wethBalance} WETH. Which token would you like to swap from? (e.g., WETH)`,
                },
              ]);

              setPendingSwap({
                step: "AWAIT_SELL_TOKEN",
                details: {},
              });
              return;
            }

            // User provided sell token
            if (pendingSwap?.step === "AWAIT_SELL_TOKEN") {
              const sellToken = currentInput.trim().toUpperCase();

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Got it, you want to swap from ${sellToken}. Which token would you like to swap to?`,
                },
              ]);

              setPendingSwap({
                step: "AWAIT_BUY_TOKEN",
                details: {
                  ...pendingSwap.details,
                  sellToken,
                },
              });
              return;
            }

            // User provided buy token
            if (pendingSwap?.step === "AWAIT_BUY_TOKEN") {
              const buyToken = currentInput.trim().toUpperCase();

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Great, you want to swap from ${pendingSwap?.details?.sellToken} to ${buyToken}. How much ${pendingSwap?.details?.sellToken} would you like to swap? (Enter amount)`,
                },
              ]);

              setPendingSwap({
                step: "AWAIT_AMOUNT",
                details: {
                  ...pendingSwap.details,
                  buyToken,
                },
              });
              return;
            }

            // User provided amount
            if (pendingSwap?.step === "AWAIT_AMOUNT") {
              const amount = currentInput.trim();
              const { sellToken, buyToken } = pendingSwap?.details;

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `To confirm: You want to swap ${amount} ${sellToken} for ${buyToken}. Would you like to proceed with the swap?`,
                },
              ]);

              setPendingSwap({
                step: "CONFIRM_SWAP",
                details: {
                  inputAmt: amount,
                  sellAddress: sellToken, // You'll need to define these addresses
                  buyAddress: buyToken,
                  sellToken,
                  buyToken,
                },
              });
              return;
            }

            // Execute final swap
            if (
              pendingSwap?.step === "CONFIRM_SWAP" &&
              isConfirmation(currentInput)
            ) {
              const { details } = pendingSwap;

              console.log(safeAddress, privateKey, details);

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: "Executing your swap...",
                },
              ]);

              const swapResponse = await fetch("/api/swap-cow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  SAFE_ADDRESS: safeAddress,
                  SIGNER_PRIVATE_KEY: privateKey,
                  buyAddress: details?.buyAddress,
                  sellAddress: details?.sellAddress,
                  inputAmt: details?.inputAmt,
                }),
              });

              if (!swapResponse.ok) throw new Error("Failed to execute swap");

              const { transactionHash } = await swapResponse.json();

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Great news! Your swap is complete. You can view the transaction here: ${transactionHash}`,
                },
              ]);

              setPendingSwap(null);
            }
          } catch (error) {
            console.error("Swap error:", error);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `I apologize, but there was an error: ${error.message}. Would you like to try again?`,
              },
            ]);
            setError(error.message);
            setPendingSwap(null);
          } finally {
            setLoading(false);
          }
          break;
        }

        case "lend":
          response = await fetch("/api/lending", {
            method: "GET",
          });
          break;

        case "trade":
          response = await fetch("/api/trade", {
            method: "GET",
          });
          break;

        case "general":
        default:
          response = await fetch("/api/general", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: currentInput }),
          });
          break;
      }

      const data = await response?.json();
      console.log({ data });

      if (data.error) {
        setError(data.error);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error}` },
        ]);
        return;
      }

      // For minting, you might want to extract and show the transaction link from data.data
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.data },
      ]);
    } catch (err) {
      setError("Failed to process request. Please try again.");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <BrainCircuit size={20} /> },
    { id: "swap", label: "Swap", icon: <ArrowRightLeft size={20} /> },
    { id: "lend", label: "Lending", icon: <PiggyBank size={20} /> },
    { id: "trade", label: "Trading", icon: <LineChart size={20} /> },
    { id: "mint", label: "Mint", icon: <ImagePlay size={20} /> },
  ];

  const visibleTabs = isConnected
    ? tabs
    : tabs.filter((tab) => tab.id === "general");

  const chains = [{ id: "arbitrum", label: "Arbitrum" }];

  return (
    <div className="flex h-screen bg-[#0a0a0a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
      {/* Sidebar */}
      <div className="w-64 bg-black/40 backdrop-blur-xl p-4 flex flex-col border-r border-purple-500/10">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 flex items-center gap-2 mb-2">
            <Rocket className="text-purple-500" size={24} />
            Trix
          </h1>
          <ConnectButton />
        </div>

        {isConnected && (
          <div className="my-6">
            <label className="block text-sm font-medium text-purple-300 mb-2">
              Select Chain
            </label>
            <Select
              value={selectedChain}
              onValueChange={(value: Chain) => setSelectedChain(value)}
            >
              <SelectTrigger className="w-full bg-black/50 text-white border-purple-500/20">
                <SelectValue placeholder="Select chain" />
              </SelectTrigger>
              <SelectContent>
                {chains.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
                    {chain.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/20"
                  : "text-purple-300 hover:bg-purple-500/10"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "assistant"
                  ? "bg-black/40 backdrop-blur-sm border border-purple-500/10"
                  : "bg-purple-500/10 backdrop-blur-sm"
              } p-4 rounded-lg`}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4">
                {message.role === "assistant" ? (
                  <BrainCircuit className="text-purple-400" />
                ) : (
                  <div className="bg-gradient-to-r from-purple-400 to-pink-600 rounded-full w-8 h-8" />
                )}
              </div>
              <div className="flex-1">
                <ResponseDisplay response={message.content} type={activeTab} />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center justify-center">
              <Loader className="animate-spin text-purple-500" size={24} />
            </div>
          )}
        </div>

        <div className="border-t border-purple-500/10 p-4 bg-black/40 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="flex items-end gap-4">
            <div className="flex-1">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !isConnected
                    ? "Connect your wallet to access DeFi features, or ask general questions"
                    : activeTab === "swap"
                    ? "e.g., 'Swap 0.1 ETH to USDC with best rate'"
                    : activeTab === "lend"
                    ? "e.g., 'Find best lending rates for ETH'"
                    : activeTab === "trade"
                    ? "e.g., 'Analyze ETH/USDC trading opportunities'"
                    : activeTab === "mint"
                    ? "e.g., 'Mint NFT with my artwork'"
                    : "Ask me anything..."
                }
                className="w-full h-24 bg-black/50 border border-purple-500/20 rounded-lg p-4 text-purple-100 placeholder-purple-500/50 focus:ring-2 focus:ring-purple-500/50 focus:border-transparent resize-none"
              />
              {error && (
                <div className="text-red-400 text-sm mt-2">{error}</div>
              )}
            </div>
            <button
              type="submit"
              disabled={
                loading ||
                (!isConnected && activeTab !== "general") ||
                !userInput.trim()
              }
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white p-4 rounded-lg flex items-center justify-center transition-all duration-200 mb-2"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
