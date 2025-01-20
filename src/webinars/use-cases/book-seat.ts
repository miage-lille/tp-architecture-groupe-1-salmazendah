import { IMailer } from 'src/core/ports/mailer.interface';
import { Executable } from 'src/shared/executable';
import { User } from 'src/users/entities/user.entity';
import { IUserRepository } from 'src/users/ports/user-repository.interface';
import { IParticipationRepository } from 'src/webinars/ports/participation-repository.interface';
import { IWebinarRepository } from 'src/webinars/ports/webinar-repository.interface';
import { Participation } from 'src/webinars/entities/participation.entity';
import { UserNotFoundException } from '../exceptions/user-not-found';
import { WebinarNotFoundException } from '../exceptions/webinar-not-found';
import { AlreadyParticipatingException } from '../exceptions/already-participating';
import { NoSeatsAvailableException } from '../exceptions/no-seats-available';

type Request = {
  webinarId: string;
  user: User;
};
type Response = void;

export class BookSeat implements Executable<Request, Response> {
  constructor(
    private readonly participationRepository: IParticipationRepository,
    private readonly userRepository: IUserRepository,
    private readonly webinarRepository: IWebinarRepository,
    private readonly mailer: IMailer,
  ) {}
  async execute({ webinarId, user }: Request): Promise<Response> {
    // on verifie si l'utilisateur existe
    const existingUser = await this.userRepository.findById(user.props.id);
    if (!existingUser) {
      throw new UserNotFoundException();
    }

    // on recupere le webinaire
    const webinar = await this.webinarRepository.findById(webinarId);
    if (!webinar) {
      throw new WebinarNotFoundException();
    }

    // on verifier les places disponibles ++
    const participations =
      await this.participationRepository.findByWebinarId(webinarId);
    const availableSeats = webinar.props.seats - participations.length;
    if (availableSeats <= 0) {
      throw new NoSeatsAvailableException();
    }

    // on verifie si l'utilisateur participe déjà
    const alreadyParticipating = participations.some(
      (participation) => participation.props.userId === user.props.id,
    );
    if (alreadyParticipating) {
      throw new AlreadyParticipatingException();
    }

    // on crée une nouvelle participation
    const participation = new Participation({
      userId: user.props.id,
      webinarId,
    });
    await this.participationRepository.save(participation);

    // on envoie un email a l'organisateur
    await this.mailer.send({
      to: webinar.props.organizerId,
      subject: 'New participant registered',
      body: `User ${user.props.email} has registered for your webinar: ${webinar.props.title}.`,
    });
  }
}
