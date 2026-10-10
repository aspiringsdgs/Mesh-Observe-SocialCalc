import { agentAddress, usdcBalance } from './lib.mjs'
const a = agentAddress()
console.log(`agent wallet : ${a}`)
console.log(`USDC balance : ${await usdcBalance(a)} USDC (Base Sepolia)`)
