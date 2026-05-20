const extractedText = `PAG. 15
2 01 .5 76 .1 35 -M E 4 8 .8 11 .9 25 C R IS T I A N E D E S O U Z A P I T O M B O 
2 02 .8 88 .4 08 -M E 4 9 .2 30 .7 40 T A I S D O U RA D O M A T O S 
2 02 .9 74 .9 89 -M E 4 9 .2 71 .0 24 J A I L M A BRI T O C O N C E IC A O D E C A ST R O 
2 03 .3 20 .1 81 -M E 4 9 .3 87 .6 77 P E T E R S O N D A N T A S D E S A N T A N A 
2 03 .4 30 .9 36 -M E M A T E R I A L D E C O N ST R U C A O C ON S T R U M A I S L T D A 
2 04 .5 00 .1 53 -M E C O M E R CI O E S T O F A D O S I L V A L T D A 
2 04 .7 09 .3 32 -M E 4 9 .9 15 .1 37 WE L L I S R I B E I R O D E A LM E I D A 
2 05 .1 37 .4 08 -M E P O R T O CO M E R C I O L T D A 
2 05 .5 74 .8 63 -M E L A R O S E L T D A`;

    const ies = [];
    const regex = /(?:\d\s*){2,3}\s*\.\s*(?:\d\s*){3}\s*\.\s*(?:\d\s*){3}/g;
    let match;
    while ((match = regex.exec(extractedText)) !== null) {
        const cleanIE = match[0].replace(/\D/g, '');
        if (cleanIE.length === 8 || cleanIE.length === 9) ies.push(cleanIE);
    }
    const uniqueIEs = [...new Set(ies)];
    
    console.log(uniqueIEs);
