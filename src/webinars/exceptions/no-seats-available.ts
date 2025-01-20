export class NoSeatsAvailableException extends Error {
  constructor() {
    super('No seats available');
    this.name = 'NoSeatsAvailableException';
  }
}
