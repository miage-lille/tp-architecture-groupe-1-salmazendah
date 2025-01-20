export class UserNotFoundException extends Error {
  constructor() {
    super('User does not exist');
    this.name = 'UserNotFoundException';
  }
}
