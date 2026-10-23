import unittest

from src.greeting import greeting


class GreetingTest(unittest.TestCase):
    def test_greeting_includes_name(self) -> None:
        self.assertEqual(greeting("Ada"), "Hello, Ada.")


if __name__ == "__main__":
    unittest.main()
