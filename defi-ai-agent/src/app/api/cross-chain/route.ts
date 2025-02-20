/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { srcChainId, destChainId, amount, receivingAccountAddress } = body;
    if (!srcChainId || !destChainId || !amount || !receivingAccountAddress) {
      return NextResponse.json(
        { error: "Missing required input or environment variables" },
        { status: 400 }
      );
    }

    const res = await axios.post("http://localhost:8080/api/sendOFT", {
      srcChainId,
      destChainId,
      amount,
      receivingAccountAddress,
    });
    
    return NextResponse.json(res.data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error },
      { status: 500 }
    );
  }
}
