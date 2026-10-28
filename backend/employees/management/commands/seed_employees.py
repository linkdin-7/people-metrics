from django.core.management.base import BaseCommand, CommandError

from employees.seed import SeedError, seed_employees


class Command(BaseCommand):
    help = "Create synthetic employees for development and demos."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--count", type=int, default=10000)
        parser.add_argument("--seed", type=int, default=42)
        parser.add_argument("--reset", action="store_true")

    def handle(self, *args, **options) -> None:
        try:
            created = seed_employees(options["count"], options["seed"], options["reset"])
        except (SeedError, ValueError) as error:
            raise CommandError(str(error)) from error
        self.stdout.write(f"Created {created} employees")
