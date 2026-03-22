const DEFAULT_NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "testnet"

/** Build a Hashscan explorer URL for a given consensus timestamp. */
export function hederaExplorerUrl(
  consensusTimestamp: string,
  network?: string
): string {
  return `https://hashscan.io/${network ?? DEFAULT_NETWORK}/transaction/${consensusTimestamp}`
}

/** Build a Hashscan topic URL. */
export function hederaTopicUrl(
  topicId: string,
  network?: string
): string {
  return `https://hashscan.io/${network ?? DEFAULT_NETWORK}/topic/${topicId}`
}
