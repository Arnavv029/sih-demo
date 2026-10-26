"""pytest configuration.

Tests import everything through the ``backend`` package.  Running pytest from the
project root puts the root on sys.path; the line below makes that work no matter
where pytest is started from.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
