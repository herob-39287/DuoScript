
export const normalizeJapanese = (str: string): string => {
  return str
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[ぁ-ん]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60));
};

export const calculateSimilarity = (s1: string, s2: string): number => {
  const n1 = s1.length, n2 = s2.length;
  if (n1 === 0 || n2 === 0) return 0;
  
  const dp = Array.from({ length: n1 + 1 }, () => Array(n2 + 1).fill(0));
  for (let i = 0; i <= n1; i++) dp[i][0] = i;
  for (let j = 0; j <= n2; j++) dp[0][j] = j;

  for (let i = 1; i <= n1; i++) {
    for (let j = 1; j <= n2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const dist = dp[n1][n2];
  return 1 - dist / Math.max(n1, n2);
};
