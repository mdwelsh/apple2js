export default function ApplesoftDump(mem)
{
    var _mem = mem;

    var LETTERS =
    '                                ' +
    ' !"#$%&\'()*+,-./0123456789:;<=>?' +
    '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_' +
    '`abcdefghijklmnopqrstuvwxyz{|}~ ';
    var TOKENS = {
        0x80: 'END',
        0x81: 'FOR',
        0x82: 'NEXT',
        0x83: 'DATA',
        0x84: 'INPUT',
        0x85: 'DEL',
        0x86: 'DIM',
        0x87: 'READ',
        0x88: 'GR',
        0x89: 'TEXT',
        0x8a: 'PR#',
        0x8b: 'IN#',
        0x8c: 'CALL',
        0x8d: 'PLOT',
        0x8e: 'HLIN',
        0x8f: 'VLIN',
        0x90: 'HGR2',
        0x91: 'HGR',
        0x92: 'HCOLOR=',
        0x93: 'HPLOT',
        0x94: 'DRAW',
        0x95: 'XDRAW',
        0x96: 'HTAB',
        0x97: 'HOME',
        0x98: 'ROT=',
        0x99: 'SCALE=',
        0x9a: 'SHLOAD',
        0x9b: 'TRACE',
        0x9c: 'NOTRACE',
        0x9d: 'NORMAL',
        0x9e: 'INVERSE',
        0x9f: 'FLASH',
        0xa0: 'COLOR=',
        0xa1: 'POP=',
        0xa2: 'VTAB',
        0xa3: 'HIMEM:',
        0xa4: 'LOMEM:',
        0xa5: 'ONERR',
        0xa6: 'RESUME',
        0xa7: 'RECALL',
        0xa8: 'STORE',
        0xa9: 'SPEED=',
        0xaa: 'LET',
        0xab: 'GOTO',
        0xac: 'RUN',
        0xad: 'IF',
        0xae: 'RESTORE',
        0xaf: '&',
        0xb0: 'GOSUB',
        0xb1: 'RETURN',
        0xb2: 'REM',
        0xb3: 'STOP',
        0xb4: 'ON',
        0xb5: 'WAIT',
        0xb6: 'LOAD',
        0xb7: 'SAVE',
        0xb8: 'DEF',
        0xb9: 'POKE',
        0xba: 'PRINT',
        0xbb: 'CONT',
        0xbc: 'LIST',
        0xbd: 'CLEAR',
        0xbe: 'GET',
        0xbf: 'NEW',
        0xc0: 'TAB(',
        0xc1: 'TO',
        0xc2: 'FN',
        0xc3: 'SPC(',
        0xc4: 'THEN',
        0xc5: 'AT',
        0xc6: 'NOT',
        0xc7: 'STEP',
        0xc8: '+',
        0xc9: '-',
        0xca: '*',
        0xcb: '/',
        0xcc: '^',
        0xcd: 'AND',
        0xce: 'OR',
        0xcf: '>',
        0xd0: '=',
        0xd1: '<',
        0xd2: 'SGN',
        0xd3: 'INT',
        0xd4: 'ABS',
        0xd5: 'USR',
        0xd6: 'FRE',
        0xd7: 'SCRN(',
        0xd8: 'PDL',
        0xd9: 'POS',
        0xda: 'SQR',
        0xdb: 'RND',
        0xdc: 'LOG',
        0xdd: 'EXP',
        0xde: 'COS',
        0xdf: 'SIN',
        0xe0: 'TAN',
        0xe1: 'ATN',
        0xe2: 'PEEK',
        0xe3: 'LEN',
        0xe4: 'STR$',
        0xe5: 'VAL',
        0xe6: 'ASC',
        0xe7: 'CHR$',
        0xe8: 'LEFT$',
        0xe9: 'RIGHT$',
        0xea: 'MID$'
    };

    function readByte(addr) {
        var page = addr >> 8,
            off = addr & 0xff;

        return _mem.read(page, off);
    }

    function readWord(addr) {
        var lsb, msb;

        lsb = readByte(addr);
        msb = readByte(addr + 1);

        return (msb << 8) | lsb;
    }

    function readInt(addr) {
        var lsb, msb;

        msb = readByte(addr);
        lsb = readByte(addr + 1);

        return (msb << 8) | lsb;
    }

    function readFloat(addr) {
        var exponent = readByte(addr);
        if (exponent === 0) {
            return 0;
        }
        exponent = (exponent & 0x80 ? 1 : -1) * ((exponent & 0x7F) - 1);

        var msb =  readByte(addr + 1);
        var sb3 =  readByte(addr + 2);
        var sb2 =  readByte(addr + 3);
        var lsb =  readByte(addr + 4);
        var sign = msb & 0x80 ? -1 : 1;
        msb &= 0x7F;
        var mantissa = (msb << 24) | (sb3 << 16) | (sb2 << 8) | lsb;

        return sign * (1 + mantissa / 0x80000000) * Math.pow(2, exponent);
    }

    function readString(len, addr) {
        var str = '';
        for (var idx = 0; idx < len; idx++) {
            str += String.fromCharCode(readByte(addr + idx) & 0x7F);
        }
        return str;
    }

    function readVar(addr) {
        var firstByte = readByte(addr);
        var lastByte = readByte(addr + 1);
        var firstLetter = firstByte & 0x7F;
        var lastLetter = lastByte & 0x7F;

        var name =
            String.fromCharCode(firstLetter) +
            (lastLetter ? String.fromCharCode(lastLetter) : '');
        var type = (lastByte & 0x80) >> 7 | (firstByte & 0x80) >> 6;

        return { name, type };
    }

    function readArray(addr, type, sizes) {
        function _readArray(sizes) {
            var strLen, strAddr;
            var value;
            var ary = [];
            var len = sizes[0];

            for (var idx = 0; idx < len; idx++) {
                if (sizes.length > 1) {
                    value = _readArray(sizes.slice(1));
                } else {
                    switch (type) {
                    case 0: // Real
                        value = readFloat(addr);
                        addr += 5;
                        break;
                    case 1: // String
                        strLen = readByte(addr);
                        strAddr = readWord(addr + 1);
                        value = readString(strLen, strAddr);
                        addr += 3;
                        break;
                    case 3: // Integer
                        value = readInt(addr);
                        addr += 2;
                        break;
                    }
                }
                ary[idx] = value;
            }
            return ary;
        }
        return _readArray(sizes);
    }

    return {
        dumpProgram: function() {
            var str = '';
            var start = readWord(0x67); // Start
            var end = readWord(0xaf); // End of program
            var addr = start;
            do {
                var line = '';
                var next = readWord(addr);
                addr += 2;
                var lineno = readWord(addr);
                addr += 2;

                line += lineno;
                line += ' ';
                var val = false;
                do {
                    if (addr < start || addr > end)
                        return str;

                    val = readByte(addr++);
                    if (val >= 0x80) {
                        line += ' ';
                        line += TOKENS[val];
                        line += ' ';
                    }
                    else
                        line += LETTERS[val];
                } while (val);
                line += '\n';
                str += line;
                addr = next;
            } while (addr && addr >= start && addr < end);

            return str;
        },

        dumpVariables: function() {
            const simpleVariableTable = readWord(0x69);
            const arrayVariableTable = readWord(0x6B);
            const variableStorageEnd = readWord(0x6D);
            // var stringStorageStart = readWord(0x6F);

            let addr;
            const vars = [];
            let value;
            let strLen, strAddr;

            for (addr = simpleVariableTable; addr < arrayVariableTable; addr += 7) {
                const { name, type } = readVar(addr);

                switch (type) {
                case 0: // Real
                    value = readFloat(addr + 2);
                    break;
                case 1: // String
                    strLen = readByte(addr + 2);
                    strAddr = readWord(addr + 3);
                    value = readString(strLen, strAddr);
                    break;
                case 3: // Integer
                    value = readInt(addr + 2);
                    break;
                }
                vars.push({ name, type, value });
            }

            while (addr < variableStorageEnd) {
                const { name, type } = readVar(addr);
                const off = readWord(addr + 2);
                const dim = readByte(addr + 4);
                const sizes = [];
                for (let idx = 0; idx < dim; idx++) {
                    sizes[idx] = readInt(addr + 5 + idx * 2);
                }
                value = readArray(addr + 5 + dim * 2, type, sizes);
                vars.push({ name, sizes, type, value });

                addr += off;
            }

            return vars;
        },

        toString: function() {
            return this.dumpProgram();
        }
    };
}
