// Confirms that an order amount is backed by the product listing or the chat.

export interface OrderSourceCheck {
  proof_verified: boolean;
  ai_reasoning: string;
  source_text: string;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function chatMentionsAmount(messages: string[], cents: number): boolean {
  const dollars = cents / 100;
  const variants = [dollars.toFixed(2).replace('.', '\\.')];
  if (Number.isInteger(dollars)) variants.push(String(dollars));
  return messages.some((text) => {
    const normalized = text.replace(/[$,\s]/g, '');
    return variants.some((v) => new RegExp(`(^|[^\\d.])${v}(?!\\d)`).test(normalized));
  });
}

export function verifyOrderSource(
  amountCents: number,
  productTitle: string,
  productPriceCents: number,
  chatMessages: string[]
): OrderSourceCheck {
  if (amountCents === productPriceCents) {
    return {
      proof_verified: true,
      source_text: `Listed price for "${productTitle}": ${formatDollars(productPriceCents)}`,
      ai_reasoning: `The order of ${formatDollars(amountCents)} matches the listing for "${productTitle}".`,
    };
  }
  if (chatMentionsAmount(chatMessages, amountCents)) {
    return {
      proof_verified: true,
      source_text: `Amount ${formatDollars(amountCents)} was agreed in the chat`,
      ai_reasoning: `The order of ${formatDollars(amountCents)} appears in the buyer and seller conversation.`,
    };
  }
  return {
    proof_verified: false,
    source_text: `Amount ${formatDollars(amountCents)} was not found in the chat or listing`,
    ai_reasoning: `The order of ${formatDollars(amountCents)} could not be matched to the listing or the conversation. Check the amount before the buyer approves.`,
  };
}
