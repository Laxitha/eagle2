"""
CaseFlow — CSV/DataFrame cleaning utilities.

Applies normalizer.py functions column-by-column based on record type, drops
obvious exact duplicates, and reports missing-value counts so problems
surface before entity resolution runs.
"""
import pandas as pd

from normalizer import (
    normalize_account,
    normalize_address,
    normalize_name,
    normalize_phone,
    normalize_vehicle,
)

# Which columns get which normalizer, per source record type.
COLUMN_RULES = {
    "cases": {},
    "cdr": {"caller": normalize_phone, "receiver": normalize_phone},
    "financial": {"sender_acc": normalize_account, "receiver_acc": normalize_account},
    "vehicle": {"owner": normalize_name, "vehicle_number": normalize_vehicle, "address": normalize_address},
    "location": {},
}

NAME_COLUMNS = {"owner", "name", "person", "caller_name", "receiver_name"}


def clean_csv(dataframe: pd.DataFrame, record_type: str) -> pd.DataFrame:
    """Normalize known columns for `record_type`, drop exact duplicate rows,
    and strip fully-empty rows. Returns a new DataFrame; does not mutate input."""
    df = dataframe.copy()

    df = df.dropna(how="all")

    rules = COLUMN_RULES.get(record_type, {})
    for column, fn in rules.items():
        if column in df.columns:
            df[column] = df[column].fillna("").astype(str).map(fn)

    for column in df.columns:
        if column in NAME_COLUMNS and column not in rules:
            df[column] = df[column].fillna("").astype(str).map(normalize_name)

    before = len(df)
    df = df.drop_duplicates()
    dropped = before - len(df)
    if dropped:
        print(f"[data_cleaner] dropped {dropped} exact-duplicate rows from {record_type}")

    missing = df.isna().sum()
    missing = missing[missing > 0]
    if not missing.empty:
        print(f"[data_cleaner] missing values in {record_type}:\n{missing}")

    return df.reset_index(drop=True)


def load_and_clean(path: str, record_type: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    return clean_csv(df, record_type)


if __name__ == "__main__":
    import sys
    from pathlib import Path

    data_dir = Path(__file__).parent.parent / "data"
    for fname, rtype in [
        ("cases.csv", "cases"),
        ("cdr_records.csv", "cdr"),
        ("financial_records.csv", "financial"),
        ("vehicle_records.csv", "vehicle"),
        ("location_records.csv", "location"),
    ]:
        fpath = data_dir / fname
        if fpath.exists():
            cleaned = load_and_clean(str(fpath), rtype)
            print(f"{fname}: {len(cleaned)} rows after cleaning")
        else:
            print(f"skip {fname} (not found)", file=sys.stderr)
