#!/usr/bin/bash
echo "VNVDIR=\"$(pwd)/$1\"" > rc
echo "PRJDIR=\"$(pwd)/$2\"" >> rc
cat >> rc << EOF
a() {
    source \$VNVDIR/bin/activate
}
mng() {
    \$PRJDIR/manage.py "\$@"
}
EOF

source rc
