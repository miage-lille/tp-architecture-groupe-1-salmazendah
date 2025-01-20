export class AlreadyParticipatingException extends Error {
  constructor() {
    super('User is already participating for this webinar');
    this.name = 'AlreadyParticipatingException';
  }
}
