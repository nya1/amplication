import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { JWT_SECRET_KEY } from "src/constants";
import { SecretsManagerModule } from "src/providers/secrets/secretsManager.module";
import { SecretsManagerService } from "src/providers/secrets/secretsManager.service";
import { QueueModule } from "src/queue/queue.module";
import { JwtStrategy } from "./jwt/jwt.strategy";
import { jwtSecretFactory } from "./jwt/jwtSecretFactory";

@Module({
  imports: [
    QueueModule,
    SecretsManagerModule,
    JwtModule.registerAsync({
      imports: [SecretsManagerModule],
      inject: [SecretsManagerService, ConfigService],
      useFactory: async (secretsService: SecretsManagerService) => {
        const secret = await secretsService.getSecret<string>(JWT_SECRET_KEY);
        if (!secret) {
          throw new Error("Didn't get a valid jwt secret");
        }
        return {
          secret: secret,
        };
      },
    }),
  ],
  providers: [JwtStrategy, jwtSecretFactory],
})
export class AuthModule {}
