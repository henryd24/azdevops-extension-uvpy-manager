"""Comprueba que el entorno activo es un venv con las dependencias del fixture."""
import sys

import six  # noqa: F401  (dependencia de tests/fixtures/sample)

print(f"python {sys.version.split()[0]} prefix={sys.prefix}")
