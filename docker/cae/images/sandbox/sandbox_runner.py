"""Sandbox runner for executing AI-generated Python code safely.

Reads a Python script from stdin, executes it in a restricted environment,
and captures stdout/stderr.
"""

import sys
import json
import traceback
from io import StringIO

# Optional: use RestrictedPython for untrusted code
# from RestrictedPython import compile_restricted, safe_globals


def main():
    script = sys.stdin.read()
    stdout = StringIO()
    stderr = StringIO()

    try:
        # For MVP, use simple exec with limited globals
        # Phase 2 will add RestrictedPython for production
        safe_globals = {
            "__builtins__": {
                "print": print,
                "len": len,
                "range": range,
                "list": list,
                "dict": dict,
                "int": int,
                "float": float,
                "str": str,
                "bool": bool,
                "abs": abs,
                "min": min,
                "max": max,
                "sum": sum,
                "round": round,
                "enumerate": enumerate,
                "zip": zip,
                "map": map,
                "filter": filter,
                "sorted": sorted,
                "isinstance": isinstance,
                "True": True,
                "False": False,
                "None": None,
            },
            "numpy": __import__("numpy"),
        }

        sys.stdout = stdout
        sys.stderr = stderr

        exec(script, safe_globals)

        result = {
            "success": True,
            "stdout": stdout.getvalue(),
            "stderr": stderr.getvalue(),
        }
    except Exception as e:
        result = {
            "success": False,
            "stdout": stdout.getvalue(),
            "stderr": stderr.getvalue(),
            "error": str(e),
            "traceback": traceback.format_exc(),
        }
    finally:
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__

    print(json.dumps(result))


if __name__ == "__main__":
    main()
