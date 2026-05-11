from pathlib import Path
import re
root = Path('platform/src')
app = Path('platform/src/App.tsx')
text = app.read_text(encoding='utf-8')
imports = re.findall(r'const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\(\'@/pages/(.+?)\'\)\)', text)
imports += re.findall(r'const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\(\"@/pages/(.+?)\"\)\)', text)
imports += re.findall(r'const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\(\'\.\/pages/(.+?)\'\)\)', text)
imports_dict = {name: path for name, path in imports}
route_elts = []
for m in re.finditer(r'<Route[^>]+element=\{([^\}]+)\}', text):
    expr = m.group(1)
    for comp_match in re.finditer(r'<([A-Za-z0-9_]+)', expr):
        comp = comp_match.group(1)
        if comp in imports_dict:
            route_elts.append(comp)
import_path_files = [Path(p).stem for p in imports_dict.values()]
page_files = [p for p in root.glob('pages/**/*.ts*')]
imported_pages = set(imports_dict.keys())
route_comps = route_elts
not_imported = [c for c in route_comps if c not in imported_pages]
unused_imports = [c for c in imported_pages if c not in route_comps]
missing_files = []
for name, p in imports_dict.items():
    base = Path('platform/src/pages') / Path(p)
    if not any((base.with_suffix(ext)).exists() for ext in ['.tsx', '.ts', '.jsx', '.js']):
        missing_files.append(name)
unused_pages = [str(p.relative_to(root)) for p in page_files if p.stem not in import_path_files]
print('TOTAL IMPORTED PAGE COMPONENTS', len(imports_dict))
print('TOTAL ROUTE PATHS', len(route_elts))
print('COMPONENTS USED IN ROUTES BUT NOT IMPORTED', not_imported)
print('COMPONENTS IMPORTED BUT NOT USED IN ROUTES', unused_imports)
print('IMPORTS POINTING TO MISSING FILES', missing_files)
print('PAGE FILES NOT IMPORTED IN App.tsx:')
for p in sorted(unused_pages):
    print('  ', p)
