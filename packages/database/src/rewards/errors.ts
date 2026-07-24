export class RewardActionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "RewardActionError";
  }
}
