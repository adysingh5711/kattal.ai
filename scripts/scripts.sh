# 1) Excel → Markdown (batch with markitdown)
# From your project root, inside .venv:

source .venv/bin/activate

for f in "public/docs/pdf-md-pdf/complete data of Kattakada (1)"/*.xlsx; do
  [ -e "$f" ] || continue
  out="${f%.xlsx}.md"
  echo "Converting to MD: $f -> $out"
  markitdown "$f" -o "$out"
done

This will create a .md next to each .xlsx in that folder.

# 2) Markdown → PDF (batch with pandoc + wide geometry)

for f in "public/docs/pdf-md-pdf/complete data of Kattakada (1)"/*.md; do
  [ -e "$f" ] || continue
  out="${f%.md}.pdf"
  echo "Converting to PDF: $f -> $out"
  pandoc "$f" \
    -o "$out" \
    --pdf-engine=xelatex \
    -V mainfont='Noto Sans Malayalam' \
    -V geometry:'paperwidth=18in, paperheight=11in, margin=1cm' #32 for max width with overlapping files
done


# 3) Markdown → PDF (batch with pandoc + auto wide geometry)
dir="public/docs/pdf-md-pdf/complete data of Kattakada (1)"

for f in "$dir"/*.md; do
  [ -e "$f" ] || continue
  out="${f%.md}.pdf"

  # Get the first table header line (starts with |)
  header_line=$(grep -m1 '^|' "$f" || true)

  # Count '|' to estimate column count
  cols=$(printf '%s\n' "$header_line" | awk -F'|' '{print NF-2}')  # minus outer pipes

  # Decide paperwidth based on column count
  if [ "$cols" -gt 14 ]; then
    pw="32in"
  else
    pw="18in"
  fi

  echo "Converting to PDF: $f -> $out (cols=$cols, paperwidth=$pw)"

  pandoc "$f" \
    -o "$out" \
    --pdf-engine=xelatex \
    -V mainfont='Noto Sans Malayalam' \
    -V geometry:"paperwidth=${pw}, paperheight=11in, margin=1cm"
done


# Delete all .md files
find . -maxdepth 1 -type f -name "*.md" -delete

# Delete all files except .xlsx
find . -maxdepth 1 -type f ! -name '*.xlsx,*.pdf' -delete

# Delete all files except .xlsx and .pdf
find . -maxdepth 1 -type f ! \( -name "*.xlsx" -o -name "*.pdf" \) -delete

# Move all pdf files to pdf folder
mv *.pdf pdf/


# -- Issues in --
FMB
grama panchayat
majorRoads
school (1)
water level monitoring ponds

