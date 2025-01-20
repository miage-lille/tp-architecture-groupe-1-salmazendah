import { BookSeat } from 'src/webinars/use-cases/book-seat';
import { InMemoryParticipationRepository } from 'src/webinars/adapters/participation-repository.in-memory';
import { InMemoryUserRepository } from 'src/users/adapters/user-repository.in-memory';
import { InMemoryWebinarRepository } from 'src/webinars/adapters/webinar-repository.in-memory';
import { InMemoryMailer } from 'src/core/adapters/in-memory-mailer';
import { UserNotFoundException } from '../exceptions/user-not-found';
import { WebinarNotFoundException } from '../exceptions/webinar-not-found';
import { AlreadyParticipatingException } from '../exceptions/already-participating';
import { NoSeatsAvailableException } from '../exceptions/no-seats-available';
import { User } from 'src/users/entities/user.entity';
import { Webinar } from 'src/webinars/entities/webinar.entity';

describe('Feature: Book seat for a webinar', () => {
  let participationRepository: InMemoryParticipationRepository;
  let userRepository: InMemoryUserRepository;
  let webinarRepository: InMemoryWebinarRepository;
  let mailer: InMemoryMailer;
  let useCase: BookSeat;

  // creation of the organizer of the webinar
  const organizer = new User({
    id: 'organizer-1',
    email: 'organizer1@example.com',
    password: 'password',
  });

  // creation of the participant
  const participant = new User({
    id: 'participant-1',
    email: 'participant1@example.com',
    password: 'password',
  });

  // creation of the webinar
  const webinar = new Webinar({
    id: 'webinar-1',
    organizerId: 'organizer-1',
    title: 'Webinar title',
    startDate: new Date('2024-01-10T10:00:00.000Z'),
    endDate: new Date('2024-01-10T11:00:00.000Z'),
    seats: 15,
  });

  beforeEach(() => {
    participationRepository = new InMemoryParticipationRepository();
    userRepository = new InMemoryUserRepository();
    webinarRepository = new InMemoryWebinarRepository();
    mailer = new InMemoryMailer();
    useCase = new BookSeat(
      participationRepository,
      userRepository,
      webinarRepository,
      mailer,
    );

    // on ajoute un organisateur et un participant au repository d'utilisateurs
    userRepository.database.push(organizer);
    userRepository.database.push(participant);

    // on ajoute le webinaire au repository de webinaires
    webinarRepository.database.push(webinar);
  });

  describe('Scenario: happy path', () => {
    it('should successfully book a seat for the user', async () => {
      const result = await useCase.execute({
        webinarId: 'webinar-1',
        user: participant,
      });

      expect(result).toBeUndefined();
    });

    it('should save the participation', async () => {
      await useCase.execute({ webinarId: 'webinar-1', user: participant });

      const participations = participationRepository.database;
      expect(participations.length).toBe(1);
      expect(participations[0].props.userId).toBe(participant.props.id);
    });

    it('should send an email to the organizer', async () => {
      await useCase.execute({ webinarId: 'webinar-1', user: participant });

      const sentEmails = mailer.sentEmails;
      expect(sentEmails.length).toBe(1);
      expect(sentEmails[0].to).toBe(webinar.props.organizerId);
    });
  });

  describe('Scenario: user does not exist', () => {
    it('should throw UserNotFoundException', async () => {
      const nonExistingUser = new User({
        id: 'user-404',
        email: 'user404@example.com',
        password: 'password404',
      });

      await expect(
        useCase.execute({ webinarId: 'webinar-1', user: nonExistingUser }),
      ).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('Scenario: webinar does not exist', () => {
    it('should throw WebinarNotFoundException', async () => {
      await expect(
        useCase.execute({ webinarId: 'webinar-404', user: participant }),
      ).rejects.toThrow(WebinarNotFoundException);
    });
  });

  describe('Scenario: user is already participating', () => {
    beforeEach(async () => {
      // Réservation d'une place avant pour le participant
      await useCase.execute({ webinarId: 'webinar-1', user: participant });
    });

    it('should throw AlreadyParticipatingException', async () => {
      await expect(
        useCase.execute({ webinarId: 'webinar-1', user: participant }),
      ).rejects.toThrow(AlreadyParticipatingException);
    });
  });

  describe('Scenario: no seats available', () => {
    beforeEach(async () => {
      // Réservation des places disponibles pour tous les participants
      const totalSeats = webinar.props.seats;
      // Création de participants pour chaque place
      for (let i = 1; i <= totalSeats; i++) {
        const newParticipant = new User({
          id: `participant-${i}`,
          email: `participant${i}@example.com`,
          password: `password${i}`,
        });
        userRepository.database.push(newParticipant);
        await useCase.execute({ webinarId: 'webinar-1', user: newParticipant });
      }
    });

    it('should throw NoSeatsAvailableException', async () => {
      // on essaye de réserver une place lorsque toutes les places sont déjà occupées
      await expect(
        useCase.execute({ webinarId: 'webinar-1', user: participant }),
      ).rejects.toThrow(NoSeatsAvailableException);
    });
  });
});
