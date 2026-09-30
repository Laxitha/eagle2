# EAGLE Synthetic Dataset — Ground Truth

## Hidden connector chain (the thing EAGLE should surface)

Ravi Kumar (FIR-101, Narcotics, Chennai)
  --CALLED (6x, 04/06 & 06/06 heavy)-->
Suresh Reddy (FIR-104, Financial Fraud, Hyderabad)
  --TRANSFERRED (5x NEFT, ~Rs 9,90,000, 10-14/06)-->
Arun Nair (FIR-109, Smuggling, Kochi)

Three cases opened by three different officers in three different cities,
apparently unrelated, are in fact one interstate network. This is the
"needle" the platform is designed to find.

## Entity resolution test cases (same person, different formats)

| Canonical ID | Canonical Name | Name variants injected | Phone variants injected |
|---|---|---|---|
| P01 | Ravi Kumar | Ravi Kumar / R. Kumar / RAVI KUMAR / Shri Ravi Kumar | +91 98765 43210 / 9876543210 / 091-98765-43210 |
| P02 | Suresh Reddy | Suresh Reddy / S. Reddy / SURESH REDDY / Suresh R | +91 91234 56780 / 9123456780 / 91234-56780 |
| P03 | Arun Nair | Arun Nair / A. Nair / ARUN NAIR / Mr. Arun Nair | +91 99887 76655 / 9988776655 / 099887-76655 |

(All 20 persons in `cases.csv`/`cdr_records.csv` etc. have 3-4 name-format
variants and 2-3 phone-format variants scattered across files — see
`generate_dataset.py` PERSONS list for the full canonical mapping used to
generate the data. This is the answer key for grading Laxitha's
normalizer/resolver accuracy.)

## Deliberate false-positive trap

P01 "Ravi Kumar" and P18 "Naveen Kumar" share a surname but are DIFFERENT
people (different case, different city, different phone). A good resolver
must NOT merge them just because of shared surname / partial token overlap.

## Case list (12 cases, 3 in the hidden chain)

FIR-101 Narcotics (Chennai) — Ravi Kumar, Farooq Ahmed  [chain]
FIR-102 Cybercrime (Delhi) — Priya Sharma
FIR-103 Robbery (Bangalore) — Vijay Anand, Bala Murugan
FIR-104 Financial Fraud (Hyderabad) — Suresh Reddy, Rajesh Gupta  [chain]
FIR-105 Missing Person (Chennai) — Meena Iyer
FIR-106 Extortion (Chennai) — Karthik Subramaniam, Imran Khan
FIR-107 Human Trafficking (Hyderabad) — Mohammed Yusuf
FIR-108 Vehicle Theft (Kochi) — Arun Nair, Naveen Kumar
FIR-109 Smuggling (Kochi) — Arun Nair, Deepa Krishnan  [chain]
FIR-110 Domestic Violence (Kochi) — Anitha Menon
FIR-111 Counterfeiting (Delhi) — Sanjay Verma
FIR-112 Kidnapping (Ahmedabad) — Kavya Pillai, Divya Rajan

## Files

- `cases.csv` — 12 cases
- `cdr_records.csv` — ~260 call records (includes the Ravi<->Suresh calls)
- `financial_records.csv` — ~140 transactions (includes the Suresh->Arun transfers)
- `vehicle_records.csv` — 13 vehicles
- `location_records.csv` — 70 location pings
- `investigation_reports/*.txt` — 3 freeform officer reports narrating the
  chain in prose, for NER + relation extraction testing (Leeben's pipeline)
