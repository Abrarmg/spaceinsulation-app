import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAYAAAA8AXHiAAAQAElEQVR4Aex9CZydRZXv/1TV9917e0k6IYRNNhWFToZdURAERUGBkRkNM+/NOL7RNzpPHGY0cX9Kz7ihCT4VHX/jU8dtFolPFBkQUYmAo6IBNyIgMIQEAmTp7fZdvqXq/c/X/YWALN2YTvqS+3WdW1WnTp06VfX/Ti033THoPt0RmIUR6AJrFga1qxLoAquLglkZgS6wZmVYu0q7wOpiYFZGoAusWRnWrtIusPYUDOzifnaBtYsHfE9prgusPWWmd3E/u8DaxQO+pzTXBdaeMtO7uJ9dYO3iAd9TmusCa0+Z6V3czy6wdvGAP9TcUzvVBdZTe353W++6wNptQ//UbrgLrKf2/O623nWBtduG/qndcBdYT+353W296wJrtw39U7vhLrAemt9uaieOQBdYO3Ewu6oeGoEusB4ai25qJ45AF1g7cTC7qh4agS6wHhqLbmonjkAXWI83mEMwpw7BKeFSWIoKqRumMQJdYD3aIAUICCqSXzOETAnnIQcQoHx0nycagTkNrCcyflbKFVSqeAj+mE/0HjX4iZ7XPn2VeePTPmT/aMHbMR/kk7rjhsd/ugO04/ioNxKEp38G8478RPwlL2FtFIXPVaruk3HNfr1nIPrF4r+vvRIKrsmlEd3n0UegC6xyXBRUBMxRn97rgL529bumal4dfJC8DS+p8cjEm9gcbKvhawcMLXpLsTRqHXDZRPd55Ah0gcURWabeh6A66ZJF+1dqyTcq89zxoWmzAEgeYPIQLBgjM96JeDcvufjg9y1ejiF4bup1DGe+qQ8EpALz8QiUQWc+OiidafnOspoTu5ob8yM/UXtaK25eyf358VmDELJCDBnhykgWIGJgDX+CEZ8Gn0TZqvkr9n534bkuLf64ykzAJVDFQwTm45G2TPvQgc8eDazSUx3z2erBriJXWSdHZXVk8MEhhMnpNAaB8BIRKMw8c3kaJGtn3sxvvn/v9+z9ricBrrDwbQuf1vuWgaN6/7b3yPhd8dIFQ/HSfd/Tt2ThUN9g/zvjwysXVA7b//X792CI4EPnPXsssBRU6qme86nagS62V0bz7FKfSUbHRFAB3gfoDz9gjAkh5GgndGVZhiCpRK4tFZt51OofmLcifo+Cizp1POUxYTAELcfAe+xfSE/9jspA88Z4YfKzvlq6NnLp2qzSuElM8yaJ/M22J/vVtr5tv668sffMQt9U3SLdAR9FR6dt51NEUC88FVTP/VL1UF+Tq40zg76JTBwclyiICDzhQWwBTPo8RV+tzx9+5NE4/NTj8OzTj8XSl54oR532fDni+MH8sGMO+ofDPrzX+1XnUBhiTdbCozwXIoBP3wI5r2ehr9SiYGuVEMXOxh4kj9h7XzHwVed8FO+VHtq7D94HDBkMwQOPoRdz79njgEWvYvXC89zLjj7E9s+7wixwR2QtZJzywlOpTwkcFRF+ACHJkxAN9DYOOuV4s+iwZ/kFex2Aef2L4Xp6Ec+fJ/sc/Awz+Nzn54MvOfrdz/3KwR8ZkiH/mOAStgJgnq2gxxLFEdiUCTxzBkP3KLDBiAnWIrAY6hAR2vsv/Juv9KHDHtNh9v5e5iqo1Ksc//nq0+/HhqttLINoS2bjSU9VKhcCyghyU4P4tv2nxUcec9yIbd0yYkdMq93MeQ2BGBYuCJfHpmxtbjFJNcoXPPegt55+3bErJ8EFoT4lRttDkY8UOExFAolNEGuFS6tI7MDYirGRWOOE2zv4do5tuGO7gk5JmE4x9Pe189ShU52C6vAvVp6V1ux3M5c+qznRyiUEJ1QuFlAC6FUE3lZh80a08q53ts+/9jnX3oYt/iU2dT+tLahZI5ILLIgweH7T48FLrnbb+gbyyj79K87+8Skf4oLol126zBTa8PDH++C1TeIIkRVUHBA7S6IXY97RhRkKiAiE+UUTiwI67DEdZu+TMvfUIbg1Q2uyo77e/6zKQHyVnWcP9W3JiSHLSd5+ACRKgokkmElQvXvd342+bdky2FOvPdVdf8r1m/bzi8+MW/H3ov7IJnk7y7j3ykNK1+ShQDBebNbIcjfPvuNPbjjzI6vPW50PgcWBBD6BxOBzBBGBoUuyjmAiRQ6IjIezAdaApGlBXImCHLR4qiY65jEdY+mTNHQSVMjO/s7Rh82vLfp2T7X36ZKYzIjQFwg4v9BZ46HPQ9iIkdwk8V/9/ILhDxZL52r4NaetybhvMp9b8rlttmlf0ag3v57Py10aWoQIIIUCT3AF2Exse6yVN/sn3vqH179glXquAlxD2D7WlYrNY27Ro9gSTAbOCCwN0bhigSpJPVhEwJEnofGgoMOe7Z3tMLunZW4JqpOuevazJ1xytavEh9qmy53o1pj+ipAKk1PmxcKEgFYy4V594xu2ffbUa6FLp2dDgYTJfdOQ+dKRX25c2bj/T5PRiS9X50eEgM9DnocQPIL3yHyKxCe2Pj6RZ7XW8pdefST3XPDLBpdpS0ro6Y99pdfCRaDXIgXhJg/QNdkai4juqxIZ0FmB17Him1sEu/b5vVszv7eGOapA91R6+jvt8sElYtrf8dI6tNVo5l4CVxrHCeVc0UuEDLmCirkJtKI//sX5276KIS6dpyGDYo8fZVBwKWvoinPy7x91/V/Yhlxc7bNW4ZTnSfBZRnDlCHR/oZ3a8eGRvFkdW3HcNxetWs1lcdnqwieCEDaBIy8isBawRJTlHkvJUMQABJkUFFE79iKjw4LpMHunZa7uiXRPdfzVBy5t1+pXGWcOylucbe7JIXRCXLuMsRAruakEG5phkx+3L//p+du+rcsfhgpQ4dEeEQlDFw4FlfvGkqtX5KPp+6SSWXorH7KMzitFlraQBO7k85x7Lp/39vcuf9k3Bz+mhwfwSRzh7ZiIAYkFluQixnaSjAh0YiJjUK1W/N61qc174TvREY/a3xGGTtfIwlOdtiY743vHHVut1a7hBubApJn5XLzVo5hnj3NLH4OQRT3OOsS/5Y37i376ppHrdOksJ/9x2xOE1cu4vF26zF5+7LXvxQiWiyOIQjvk7VbwScqbe0/fI4hCbNGI8rQ3/dsXXvb0z4FPXnVpXgV8hcQYjBGBXhSICK7IGbjYwKgXExF04GM60ObHNFmBoZ7qbIJKqri8Yiv7GroHrikmQ86frJjwkAlBxWlrVm7qbQ6cvvYN47eqB1oz9Nie6ncaVXCdt9ovu3SZ/fZJP/5oa2Tije1sIqS+TciGYIhi4aYt0z1X3rTjE6Pcc9Vfe/y/7PVFQma+3oD6SMQTUJ7eKzBGVSAkVxFEBJZTPo3d3N1j/c7w7zLGJKiQnXnV0iOTOLkiR3aAb4fcGsNFz8IGC+SGm+ssC7XU5WPhhspY/0u/+5q77lFQTctT/W5vwmrdOwXY619826eb9ZE/h0taXNqEoPK66gafwYc28iy1zdGmR9R+NSZap9u2gY0s91qCEAOhxpiEHjZSA8SCWzHA8XPvA9FBiyCKxxSfnf4xxM32ELLBj807oVVLr86s3y9ppzn3U1xYBJY7lkgcY5uZ/uCS0fTK5J7snO+95tatvweoUD6rBbmeIm8+e/jf+5KFr4hNZdw6Y7Is9T4kyOm1fJpBUqKkScjVvQ1b2zBOEFUjRFEFkatAYovcAqkBMhIqgkqvyw/eto8v2+qU2HSKoY9pJ0GFIbqnt+F5+xzytG/Gtf5986ae/WE9j//qNniaD7A27xnocbV6/1e2bZx41c/fPDLCeuZJeio88llzGjIF13fO+PU1tXrlHBPkQR8nJkvSPKQekgOS0QslMDw7wDc88GCOCq/447gGYzgVJiBYJcDTi6HKOjWDpGcvQYc97E2HWbyjuVOgGnhH36nzDlx45YLF++wj7cg7R3ehSx9lfR5Chsy7mrFuvPKP179i/as3jqGNIZT/YgA765kE16nuW3948w+a2yZelo03NxrD1ZgroS6LCi5ti0AHxKA9kmNiwwTB5JFHebHeORNzfxXB8pY052mxGTK7qdq9IMUue4a4/RhCNv+t7qW5a31deqIFE3bCZ2gbExwsJ87ABsNrJleluxrNLvrOWb88fygQUBciYAges/DoLb1u6H/8p5tuSh5ov8SP+9ttD83JkQvbC0SVZ4o7vYJRH2lg6x1bQTZszOXQElTctRueDK1u4CsOi1iv00JneqwpUC1+X+WlboH/f5HNFpjY+waaJstT8IaSR30brK34nlrNVlrxe64764536oQPsZSFYTYnarVu6C+F/dXfJLe61L/YZe7mqFds7kPmCecsDUh5mZrTVr0onRjJMHJHHcYSegST56zYqIKq68f8eIHfv7/7XeFsztekbn7VgiFkB32k5+xaLy7riV1fLba+f36/CdzxBm6vCK7gbRocsRUNxxd894zfvH9yk77azzaoMPXo3k3b/MlfcTl8sHJGaMkPXA9vu9I8YwBXaBLAb4Mg1mB8OMGDt4wgMhYVdszZGqyLkTmRzei8h+9GBxk9BAdukvcdsi+3cfhXK9JjgvWVODb8crmYFMnFZy5BU+pIxpPXf+vsGy/RqwhOtGdPZ9VTUf/DAtvM9V9HXH/B/Zt7K+YVzW3plVmUu8yHXAGV5R5ZCNAYxmFsxGPzunH00VNVq/OQO6AhY5KOd/dYDxvYnZpZBoshZHu9G6+wtXCZ5Hkf8uCNMEDxYhD5iq9UakaczdvjyWu///Jb/q+e1KYuPlUIu/pZvRr50BDMd88bHv3l1tYrk4nsMqnQn+aBKyPgeZEauCcEyUYWW7Y2cdfPNwIhQW7b8JKFLbva6J3QXmd4LE4MOEEHvb9yTs9882+R4Y4qC4FIMUa4L0GO0EpCtbdqjJXhvtbAOWvPvveLuqfSk9pOGKffVTEDDoHloX24EO3fjmevSlv4jHBDn0txVgSPE6QMXv9tlzW4994mbr3xHmS8/xIXY7/uHgs7/9EJGYI/4uN9S3sH5PPVyNZMEE88GeF+Suitgg+hWR+XSjve3FOvnnvl6T/6tn4Rvfq81bw92vkmPSmN7ENZ779WpG8ISXQJcWWyLAlJK0HSEuRplRTDWIctG4Btt7bRX1uAeeMLpKzbKfHc91hDRA5HM/fpRcbJIguXRc4aBlhjIPwx1mJk2zbcv+62C75+xnXXHfez4yI99rPa3Ar6FtAiejCzfkXjgpOPP+t7J7/4ZfLso5fm8wf6kfMbn7QVAA+4mmDLeg8z5uyx575EWK2jgpnT1gaiBgiDH1twkLPRaT4RGGMtL0ARRxbOOOaVZyTLcmy4b+Mw+Ky9ay2nhonpBaGYjsNjEYuLMF25QvgxP4bgh6YKzUF7jblD98KCwUPwzNOPxNFnLcFBzxiA9wnEeqShja3rR/zpC2thqkrHRDqYc9bYZatR2GcFL3CR9DhdOwSiL77urZwFwSUkxgJw8ytPojM6aZ71HotYVITpyhXCj/tx4aQXXj/2W7t54l60m3U4xBjYZ1/8wYuOw3NOXAK+Kgjs+KbN5iLbCQAAEABJREFUw+mHr/j45JL+ZHqH3fOY3dPs9FrdvA7FUHrkzzCR14zn6gcxAuE0C9VYprmZh7OW1w2OXDKnF2RKbH/GJ5NOhHMnolZ7PtPPI51IOp4UkciuHeBqtZOY1rLnc60iOZV9ATFxBPkzDmKzUBELJcv9Yt5O0Gq1sN/g03HscwcheY76mOlb8y30oMOeOQ2sciwjG2qWb68RASO+zYBhQkmMQJh2kUNfX68Hn2WkaQQ7JfNmxtcRtdfCh+vRSm5g/gaI/NBE8fer1ep+zCNN0+V5u3UD0z9g2Q3wbZK/nvnrkeAHjPcmaRD9mA4Zb2ivOiOSkAxPtzzhjjaG0X/YAizapx9pM7iqi3mjRY0zeW0ovjuD2Z2NT7dtS7fkCB71VmqwjjKzsISGI1kyXQTwazaZrs5SzlQiA4ISEAOfGwSSMM3ABcvSgRQ6syyjUylmlq0FypGgJBBrq729vbQEM3r4HQ+8b5My8INNZ8jyNtpJA+Ptcez9rAHEcfCmxxKAM1K924U5SLvdhic0wEU+CKdNKCn8UICBMQOUb5xAJMCn/E6HMjMJPs0DeAPOOqFQoopASHkPnyUB4D0AC00UBSjYtDywXK/ReM2hoqR8gh8Um1Ho971SzWoIPHikaZvOsol22kCeJQg8HfYu6MGChREe+GV9RnrngrCZC0Y8kQ2cwwBaKhEBFAtAIBVgotuSYikEJCY75oRjho/3Ah9YSQSqjOjil9gyhRPGLGJgwhS8ACZFIDJJLAs5dUwQWkzPJETeiSeoMgIpIbDSvAXvc6oGDFX2Vwawz0EDwJ0PzETtnJDlYM0JOx7XiCT1ktMjoUKx2hRVOc0Eky5GIZCnpGskkzMJJnJBdD0lmhCIMKIYxdEA+nj9UMq5kVYTIASv0qSMtgoxtohVbiY01n5QGukI0qxFpSmsoFDvQwavX+kQZFEvzw6HkI3OeuY2sF44OZiml3ftNYEocHT06bG2ey+Oe+AyyRecS8ik/Iw+6W34lTBRqv8iihMowoYYTyrR8SlAY2ACuAaLqAGUCWwxFHUAEeEeCzN9htMHpJ2OIeQpjAdMLtBlOWQZeRlaXGAlDrL3gWDBTLXvXnkduN1rwTRaj6KKRPzOzJmIc0uTOcyBYy2caBdFsDUHVETfeJZguk9QQc4nxFiItRnE5AhBKdUya6NfPvOZz7xf09Vqz7dFTDv4jCDkh9hcTMR1i/b4PDWGdVVwBlSxPfzqWd0ukCUJqan7OgiNEjpPkwAV3qMsOKBmZ6B2TohyVOaEHY9rRC2uehNZZPROuRHktNrTgfCchtwJQmzg4ipcT6UAC6b3cPooGMefsHHtxFql7+RapfckwJGgdEKep6+844472pSSRmPsKuJnKdNadlLkek+qVua9oNbXe2Jw7iXj4+PbWKZh2jYMYKGPwfWdIMp5255wr5Xnk94KPFOkXCInzEQeH2KIZlXdOWRm0dSdpjoYI94aBBEYMTA2gqGnMsYi8MeHAIFFLH2TYMG0nlBItVrrs+b4jxqN0Z81m2M/AVISfsayG0n3kTSorI7Vncwo/8Y0HftJs7n1J83x8R/xkuvn5M+kbYoDjfaYpLxeUC8oYL/Yv5zOMCEvSZpIsiYdqM8X+QNydNijgzXnTU4kkaCbEEtznYVxBsJLLBs5pi1gDBKXoikTMoPOlLKDrHMu6UzYysttpXIW02fFcc+5iw866OlMazD88AsXLhy01p5LOsf29JzF+GXWVs6Zv88+h7Jcg+jHdKkVWsgIIs9NOjxxmftib5VlbaQ+hWQBPXlv6Ef/dFXOGTkzZyx5HEMkch4EVNBl0AYEAkzTsJYAc3AmBsTwxmnyzgnTe+yU2GsZXwZjviWS/0eeZVdA5PIkaVzWGB7+XAhBweKXHnvskeP1+g/zPL8s9/6beaK/FCtX5D69vLFt2+epQ4N6NpXX9BNSr/SArwZ8SHkypIfyTVAfJARYarFimPbBpez0E2qbWwJmbpnz6NZkfJuNOES2hshViSEuhRIB3PqCU2OZ7pV+LDBP4hc7HUFLoCLQW/BOCbxWAIxABM1G4xie9vZVq+6+487zCKr5oB8BIIWc12NcQB7C4fRm8zDDJ9dljzfvuvSl3GMpqELIIRJgCNHJ34nkO7W4ztwMle9mcbOb259W846b82AdhGRsBEMgKIE+J/D19pwI4Z6rL+6dmoBpfluorXtvQA8BOkJmWZ/KmIEAuQ9Ro9GIyUejPt7vCXDlazF5rMGKDKxvCDpaQ+4MwujEJrRbdQgB7ajYwRSACtzAZ0GXwwZavoGxsRkonSOicxxYpxbDJNyWC/dVRgRK1kRwpoLYklwFloADn5bL+alhtX5MjxQsPJWJPqrcGEKKVclD8ExMBeHiRNhBgaTYEyJBJmV9nsvo6OiU4PSjnLcUCqLAvZWQDNsUngYDgZbx+kFj43Pftvpr09PXOxckzVww4ols8CmviTip1vCNNhZWLIxxk+ByVbFRBYlJMJKOmCfS9chy4+KAAphESyBqlOgFIaKibBVFAgZBRCCiixSJ/gqKMvJsFPmBgQGV1TrTplrUz5uKmPIBWZrxcJkh4/K43QRq5J1WcMkoUxSbq+FR7JrxRDyKjllnRSGWiB4qEEwgEUkQLoeB1mc8LWpceDRHrzJja4gXQ9SA++QQBMGLMK0fAOHEjyKkKQosiT4qVxIgEOc9l1TM7KnxzGe1Gr2VngBD4iEkogsEFELq0Z5om6wxLDPTvPulOTW734gnsqAx1qKfcIi4BFpxgOH9FTGkc8LpRaADqZp+7B2Vm/dp7bEKL+CzNA/8CoVATcS5BCJJ8PyiLoTMOsfL0WphnourDVEA+rwoN9YmNooSMRKyNK2PjY1lheAMPhrJqAlJCpsJdCL07GdSQNiqJOxmi+lUaCe/iEZnPdqfOWzxmsK2ZCTkNTMfJo7gjcALkIsgp/ViLSI9LXK/BUfQFTWm9eGnpFYh+KOiqjm+t1o9BiE6lvxjQoQ/cNaeALQ2Mo+kt3YR163DmdZ/VXqst/YYW60eTd4fAOFF5I+TNBAIGj0xZW2ihl4JCkmS/jUa3jwABBUIMH4XXWzmR55Y1ZyT4NTMOZseMugHk5v3ifHYcx2C0GMILGMLYy1iU0XF9BZxbnI0zLjB9J8SAPob7L9M6slv6vX6Os7qLVTxG07ure12+3amOeX8HB4eRbt9G1O/Id2CJFmXjI/fyljl7yKv1Mfk9IJzJiioePCDnwB8gypSkp5BCCxh7Cdbn57COSQ1k4nY5WavwaTH2vTgVrnvgY2Q2NApRYgcycb0VDHgJGTFP7B0sNLDqcBMH2EF8zjEoiI8npyWFUIz+UibGbJWgM8CuPyiOKDSj3qeDhlBl3njrK9Yo9mZqN7tsjqgu92IJzKgUc/s/feNIefXNkZBxSuGmCdB52IOvkHGF99bQRzTsz2Rst8tp4uATtxjUVnj8eS0rJSbdpw0gnh6qMDaSlox0IqC9NqBAOMJ0fRXBp4UcFXf7iKzuxqeUbs1kbEtLW5qhd6qgghKVUQ8KVa4v6pIDdYapJJ21gQEbqE894sEUE5fy8OhXspC017zXA55CxGKX5ac0YDtfuGOAFZvTyxN3hE2NrShv3IevEMATedXOgInxkSAIbC8J3P3D+p0LTCWa7gRhAD44FEsgUxrPifYfOaRNlL7wKYtdro654pcR0yECVaiOMZ/3X4PXCOgtzYPQlBlhFcmnmkLx418b6V3rozrtOxIxfObQYoKEEQm12OPSYARWCmB1eYtPCU6LnQEsJy4UOHeamwsxS9uXIssNNGKMqScCg+BWIveqB+LK4s7agLSdrAJgZMSRBmp8Fr0XBnXwZw7+ZRpsoOb3928z8rEWlSpV2BsBXfeuQVrv/cjnqbqqPb1orfSh1rUg6r0QpJa8aLcfP/NDkMo6FTGM6Jr4fRvaj0+nUqZJ0/HrT3OgU/G27gs98i4qdI45b5KAZZzLcxIDJQSYLR7QcqB2PnB20R0wH0CuNjiwfsmcMvVN2Pk9jvRl7iwV2UBKpUK0OM4NcAx+x6TYYg3RKQ1M6XTkOnf1Hp8WkOZJ09rj1tb3E41mmne5qkw5c07HRdSgkzvS3Nvue+y9MfEn8QYmN8FFmbjaSZN5BmPSNxPBX7XUe0LaOcZ1q39Ba6/5pvy0+u+jXU//gGuvebfz1/8AXPRj++6fOUBF9UuPvii6OJnXuwuHvx47eIjP9m/6jn/NLDqhM8tXPU80omfX7TqxC8w/YX5q573+fmrTtD4S/NXveCri1ad8rX9V57+tQNXnv71g1ee8o39V570jcUrT/jGopXHXrFw5QlXPG3lyVccuvLUKw9fefo1R68885rjVp517Skrz7ru5JUvu+H5pJNXnv6fz1/5oh+euOolN75g1Vk/e/Gq83519qpX33Leqr+85c9WnbfuVR8945YzPnraLSdfHPdWjkzb9FvBm1yXP/VcRFjGtOfXCyEIDA8leWsb3RY66jGdYC0xFAJPSyCwQIsDAqwjg/dY9STH+ns34vZbb0ejNXZudZ57u+nFm+N+/5Z4Ht4S9dq3SE1Ifrmv5Mt5F7Y8j9LlmWsv91G2XCphufT65aYvLJf+sDyrJcuT2sSKRn99RaOvviLrT1aEgbDCDLgVlfnxClmQr8gWZCvygXRFNr+5Ih1orcjmTZBaK/z8bEVYkK6wC8IKN4DlmO+X5/3Z8kZ/a3m9r758orexHH3hzf0DvX+3cGDBW3p7aoeE1ID4kZwHWs9E7gMyXpjq8hiYByRLTK3wcOigx3SCrcZgROipguFKx3fXIxQnJ3DghVspZx2iuILQNnk+ETLu7TM0TRZaJsubkgXy0jq/Kx4njfksHSUxnWi6IGTpWMiSkuo+a9WzLKnnWcp0SplswmdZXbJ8QjLPOBnPstZYmjVHW1l9fDxrjE1kyWiSZWN55kf5Ld+4ZGHEZ8lwK5vYOp6NbBvOhke2ZhPbJrIwKlm8xVJ3Goy14B4dIQSSFOSZzjyQ5imaWbvRbrbprgGeU9Apz9wG1i2gWwJ4IPyx9RbGWCf0Whx+jrEBZ4HEwJnxnjMhsIA4Ys9B7yMAZwBedMlkrGmBExLB6pSoiLJTPOVb8LtncUZMIQd4x2tMygTqYZlxLLfOGhKME7YHbxyB4Qh4xuJAPoJQh2Mb1tlAu0l5yF0rtFzugnvwvrtdvdEQUXEQXMGwO6xapEUvSnkpn6GdNf/r7qG7W5h8ivGYTM7tTzOnzVvN/SsNrI3FNzqx64VXDODwg2govlvjLRAnFOBkiBhwlkjMCiC6ZoLSpMkqZCKAGARXG0xqBsQIGBgDwZImxZgA5QgV1gEnXUm47zGe7QTWgYERA314HUUcg2c8T8oQtBHxsCyPJIIzJFgqFH79lGOkfi9+u+525MGxDV6aUC+o07OeviCe/UrznG6PgMtq/6ltYAiKOnTKMzkyc9fagEthN//j5v4pX24AAA/USURBVDp85VOmopNDdGU2IADCiTPsgYjAcNyNTh5k6gcQlkMfASebFZhmkhlA55JZFCKqQ0kLVYzOjxXAuaYIC1AWCNlsWmXIU64xljrIFzLpNQtgQBWAYBMouAzBaOj44qgHlnC5+0e3YXhLjkBeyj1WRqSnISCH548g9y73VlxSx8b2xr5PQ58LWaxxh5CO2tw29TyONS0cvv/AjyVbwrd8ZCOEyNNbZCSP4ILwB3z3gaBY4AxLCDr/PgTROS+mmIWUDuQLBakysDAQkUHoGDSvsobl9IZBSXLRnGoPJthQ5FWH9wVPuEYakqUNhoRCOoScSEnSLKT8ySQPNnahpxKHMFIPG667MwxvyENkqyFP4pAlEcmFPJfgPfeI4DVJJVgR0/b1ypsmPvvgAxiilULt6Jxn7gNrEgSCz6xNm3dP/Ek2kv8zIr7PveIkNsZEnAIHkYgwIcaM7mzIs5ERIR/CHxPEOBETk6qTZGOIq0BMhEJOqow1X5ZXrBAQYp0VoT6hnFEdFuQZcZElOYmiWOJKVWpxTaqVHomrFYl6nLgad4NxIq1kTLbes0nu+Nlv5Kbrfi2bt2bi+qriaac3htZFJCvwsQRUTHDOSRJviPP55zT+z/g3MfkfJ/jOgdSkpZ0ALLWUXgiCJWi3Lp54raTRKWhGHw2JWZu3/YY08Zt86u8PmdyH3NzrU7k3TzOS35SSnyb5/aT70izb6POwgb5rAx3NPT7zG1j/XsrcmzX9xixhmZcNJo820NlsoI4NWZZtSFrtja1Gc2Paam0IzbAhZGF9lvn1yNz6kNkNoY2NeSvcE9p+vamn99TXb92w/qa7N/3m+3fef/MVd97/0+/e+cBtv9q6qd2w90H8vWnavi/A30u3uClP0weyNN9Euidr59f48egCN9Z7/IMXPngN1FOtBo/C6LinU4ClAxtwIQJ/ZPh9w9dvee/48iX5xPPCRGPJ5m3JYPPB5IiJ4dbgeKMyOHIPaX1rcHhzcsTWenLEAxuSI+6/vzW4aWtrSWt8YsnEyMSS8c0TS8e2TCwZrk8Mjo5ODI6nE4P19fUl7s5oyfCdsmTsztEl9TtIW0eXNG4fHWzePjI4tnXzkq1bGkuGx+pLtw4PL124JVmaozVYq48P3kf+pl+1lt5z5YalP37nHUt++/oHjrjvkuEjRm+xR/SicnjN20G7ZXjQwAzath009y1cYlM5Yrw1fnh9kx2sb+wdrH+gfubYB0cueWDVAw9iCIbUcZ4KU08nAQv0WaEgbuh1U79mCNmWj2AcH8PICGn4wxjdNrRtbNslShjT/MjQjmUYu+3tGN+R7rgAY0q3vW6S/8O3b2G50mS+5Bd1VOZ1W8bXnbe5rrT6vHX1Naetq1/+itvIW1dfd/66+m0f2TKO22gTMIq7MYJvjNC2SRr+zKR9wx8eHh3+zF2jGoN24wsjI/jyAxN8aYAhnkKGOhtU4NNZwKLBRTiPy4MSIMAUTULuobzyS97uiLX9mZJaz5cFQ5MHFnTw05nAemjAA5OTJHzflSY3+w/nKX9X0452zCzNLnV+2GXACiHYKXIal0PHdLQDaZm+t0Ux+UIqy7fztZB8Q1J51atx0RfylF/WKWOrdUraQabQybzWV9kyX7Zb6tS8tqOksiW/bKuop/qndLmp9O+UK78kyqo+3kOER+pTW3Yk1aOkvB3b0volqV07lmn+kfKaL9oqbZiteJc0wgEUPvkUZRqXHWI63YEy5au8xuQHUlmuXkjZPNQpWzzLCl1Tsdd6TCu/rFPGDztZ7SBT6GRe9ahsmdcGNO+LBvlBmR3tL/jklW0V9SgG8lRX0Q+mf6dcZUpiuepMGD9Sn7a9I6keJeUVbU31VeuXVLS5g261Iy3zGrMdrV+0pfnZpF0CLHaI4xDOzfP8y0xcQjqXpG9aH+N3kT4UQljF+Hx2di+VZ6wA6iHvnaR3k+ZN8YyWM7+I9HbSV0kfIB0yxV/C9PtJHyJ9hPQJ0v8o607Fh5P3XtKBU/kVTKuuylR+L+bfR9JfXlVWL9NvIv0b6YOkFyiT8dEkbWsfzSsx/5ekv55KP49pta34B1VMFx5lh1jH4aPM63+vov19IdOfImkbQ4y1D59kfCRpKelC0nzVPdXXFzP/WdKXSK8kv9DPWHX9T/L+num9SJpXD6b1XziVn9W5n1Xl7Fihn/G72ZnLjDEnMP4T0mUk/Ut6ukRp5/+K+ZeSPklaQ/l9GWt4GT8+SHo/6eUk9QjqmZ5BGf1zjh8i70jSctJt5B3GWEnbezXTLydPB1x/e5lZnrb0EziGkbb7DMYaVvDjItIbSBoUKP+bieeSdFIuZfwJkrb1VsZfIGk4jh/a1n6My/A6JvQFYQSdxHcxsYCkQZdUYkKjoH9YfCWZbya9jaThENqr/VTbL2T6v5HOZsFC0smkIdIiktr0PsbfJZ1BUmB+jfFnSVqm46pj+l7mS9360mj908nToDIazwoVEz8bmjkgOoAKAn2LdLD/g4xnsa39SfofHf2ase5FlC5mmU7aOeQtISmgGOG/8+NWkv5GsgKSySK8m/IHM3U84yMYL/Xer2bcJpXu/5UsW0o6kPQm8jUUywgTKscI5fIxoRmSes8DGJf5Ufajl/XVnuWM1TYFUWlL2daOS22bdZrUoaGMy3aVV465vkgK4P8g83TWOYD6v8iXT//sZAFM5l/DvHriNZTRcWKEOmUPYUKB/8+U0f49k/l/IKm3fBF5OWXKvv0N088hT/ukvBblNOxok+Z3KpWd3KlKVRk7wv6EYtli/nuks8i4grGC7HYtZ7p8a6pMa1BwabxVP0h/TLqE9CmSLhvFksL0i0nXUMdN1MlI7uAEvIaJe8hXT8AIf8eyDzBxMWMFH5PbPVbZbwW98vciMP+FiXGSepESKBXq1AnRX6vXZemLLFfP8SvGGsr6Zaw8fvHDL5M0he3tTeZ2+GR7+pdLNpGl3rKX8R+SylCOSxkrv7RZgaF/uVl5pefU9Gf0g1Qs07RbvdzVzK9j/z9GUl2qQ2OyZzdoQ7PZQvlW6PKhANHlT7+tv4cdVa+lg6Te4z3M69utQLiCg3I58/9tyrAfMp78pyNAMfgs07/2Okq+Bt076NssmimJMqpf/2it1lEvo0UPk1HGFNUITPWKf8u8tqv11LaYeQ0KgquYeAnp66SfUX/EWD0Ao4cC+aWXfogJlJOpoFNv0sP2XkGBq9hX9ci3st55zD8yyCMZzOvmu4exBn0RdOnTeSz/7l9ZpvbpC/omtqFL5RvZhsqorNadVdoljbAHOvFvYwf1rxA/jfk+km6oE8YVvr3qLRQAuhfSSSV7EkRM6H/d9n3GGooy6tE/i324MpjW5UgBfD4HTjfjClSQ/+ckXboOY1zWLz2Rymv1khQgCyh3JRnXknTvpl5U7WMWOkHLWK7L+B+R8QcktVf5TEL3Lxpru/z6WdTLFfmpDwWpJst2z2RGx+CvaXOd6WdR93OZLvd8JaBKeYpsDwqYu6dyugRqmwq20itvmCrTPs2n3h8xr572IqbV45d9Inv2wqwBi4PEfhSbVG3jO+zCleSpmz6KaQ0P8qOYaL696yh8DfO/Yqxv9GLKLpsCnHqLMv1H5Ku3+jhl9ZT0YeZVn+4vPkaenuIKYDF9Gst0Al/F+BTmdwxqk+bLCdS8kvJ0s1tOaIt11dvpRH6caf0PBJ6tQqQRUrkk6nJ7Cst1w6wHlB+wTIO+UBrrIUL/zPcyyuzHfik4FZR/ykL1kK9nrJ5G+Uxu93Clfcor7evjGOlYqYfV/r+UOnVp/DRjtUk9qsprH8r67yGj/J+elM8syjJN73QqjX0Uxb8fi50vOsBY3yY98qu3Um+gXkH/SL+esnQw9Q1S0gbLiTid9YSA+zjjq5WYVnnV+Srmv0Lhd5D+F0lPh3ryuoT8bzJf6nwHB1oH+avk6emI0fag7ekbraRMXVYbmqAO1acnRM3q3ZHugxTIf0bGTSQt+zzlvke6l3n9c97qPbVveqr9V/IuJmlQb6Sx5vVkqZ75deyLgu/LrP8NFuqh5nOM19JeBR+TUA+nnri0T3n6wqjd5ZzpC6c2X8V6CuTF1PfHJLVX5XXZK9onT73Yhcok6ZaDEXQsNZ4VKo2cFeWlUnbsCyQ97ajrPpr8U5jfwlg7vzdj3X8xQtlpvY7QI7oOtt536R5FJ1xd+b+rIOt/mPG+JNW3iPkLmNagBwTVuR95eurSex9dtsB84SEppCcxvd9RgDMLPa3q9YPuV/RNVvBoPbVD672dQnrMV+/4bOrRA0ghy/Q/s0y9ml5z7Mu8ArD8Ox6fZ5narCdNtVXv4hRkzyFf7810/PVGXeOTWLdY6lmm+zlt7wamy6BXCdovPaAoT72lLsmHsp4CW0+P1xJkar+Wv4gff0kq7GSsL6P2Sfe42qcdQcvinRu0QztX46NoY2ctO6+32esZ/4IiKXlMivLGmNA3UTtbvEXMN0nKV49R3ixrWnkF+FhfT5z62wi3UHYr88WAMq03zio3zrSSpvXNZrOTgfxSpgAa8yqjXqK0obSrsJO61X6t8xvK3s68rvFMalScfNXGu8gYZtn2MWVeb9VHGasdJWnf1EMWt+AsU73atzbTylcblKc2Ffap1SxTXcrTFUBZBZF/D+kOkm4hdEzKMZwgr+g3Y+2PktZXz1fUnc2P7YMwm42wY9ppnYXy7dTBKwaAE6H8AhSlDY/G07Id+dRZnL7IU53MysP0kV/oLWOtX9IjeY/MUxlZobBJ06SH2c98UFJ9jEs7ivY0T3pcW6i80K31S1KekuY1VtJ0SZpXKvPahhJ52n8lZmU76Mgv7CnlNX40nvJng3YJsNRw9lonQ99MpWLgd+Bvzz8W79H4O+jcXn+Kp209jLR+SaXMY+WVrzIal6R5ktq+ffIeUVa0V/I0pnzBe6xYZUoqZTS/Y1rzSo/Gm+IXNmm55kvSvFKZ11jzSpqebdplwJrtjnT1z60R6AJrbs3HbrFmNhrtAms2RrWrE11gdUEwKyPQBdasDGtXaRdYXQzMygh0gTUrw9pV2gVWFwOzMgJdYM3KsP6eSp8C1bvAegpM4lzsQhdYc3FWngI2dYH1FJjEudiFLrDm4qw8BWzqAuspMIlzsQtdYM3FWXkK2NQF1rQmsSs00xHoAmumI9aVn9YIdIE1rWHqCs10BLrAmumIdeWnNQJdYE1rmLpCMx2BLrBmOmJd+WmNQBdY0xqmrtBMR6BTgTXTfnbld/EIdIG1iwd8T2muC6w9ZaZ3cT+7wNrFA76nNNcF1p4y07u4n11g7eIB31Oa6wJrT5npXdzPnQasXWx3t7k5PgJdYM3xCepU87rA6tSZm+N2d4E1xyeoU83rAqtTZ26O290F1hyfoE41rwusTp253Wb39Br+/wAAAP//qAcBCwAAAAZJREFUAwD1TDmGdAVS8AAAAABJRU5ErkJggg==";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateEstimatePdf(est: any): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // US Letter dimensions: 8.5 x 11 inches (612 x 792 points at 72 dpi)
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 36; // 0.5 inch margins
  const contentWidth = pageWidth - margin * 2;

  const brandGreen = rgb(0.463, 0.769, 0.259); // #76C442
  const textDark = rgb(0.082, 0.102, 0.176);   // #151A2D
  const textMuted = rgb(0.392, 0.455, 0.545);  // #64748B
  const borderLight = rgb(0.898, 0.906, 0.922);// #E5E7EB

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // 1. TOP HEADER: Branding Lockup on Left, ESTIMATE # and SENT ON on Right
  try {
    const logoImgBytes = base64Decode(LOGO_BASE64);
    const logoImg = await pdfDoc.embedPng(logoImgBytes);
    page.drawImage(logoImg, {
      x: margin + 11,
      y: y - 50,
      width: 50,
      height: 50,
    });
  } catch (_) {}

  // Brand text directly underneath logo icon
  const spaceText = "SPACE";
  const spaceW = fontBold.widthOfTextAtSize(spaceText, 11);
  page.drawText(spaceText, { x: margin + (72 - spaceW) / 2, y: y - 61, size: 11, font: fontBold, color: textDark });

  const insText = "INSULATION";
  const insW = fontBold.widthOfTextAtSize(insText, 8.5);
  page.drawText(insText, { x: margin + (72 - insW) / 2, y: y - 71, size: 8.5, font: fontBold, color: brandGreen });

  // Right side: ESTIMATE #1045 + SENT ON
  const rawNum = String(est.estimate_number || "1001").trim();
  const normalizedNum = rawNum.replace(/^EST[-_\s]*/i, "").replace(/^#/, "") || rawNum;
  const estNumText = `ESTIMATE #${normalizedNum}`;
  const estNumWidth = fontBold.widthOfTextAtSize(estNumText, 18);
  page.drawText(estNumText, { x: pageWidth - margin - estNumWidth, y: y - 18, size: 18, font: fontBold, color: textDark });

  const sentDateStr = est.sent_at || est.created_at
    ? new Date(est.sent_at || est.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : "";
  const sentLabel = "SENT ON";
  const sentLabelWidth = fontBold.widthOfTextAtSize(sentLabel, 8.5);
  page.drawText(sentLabel, { x: pageWidth - margin - sentLabelWidth, y: y - 32, size: 8.5, font: fontBold, color: textMuted });

  const dateWidth = fontBold.widthOfTextAtSize(sentDateStr, 10);
  page.drawText(sentDateStr, { x: pageWidth - margin - dateWidth, y: y - 44, size: 10, font: fontBold, color: textDark });

  y -= 82;

  // Thin Green Divider Line
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 2, color: brandGreen });
  y -= 16;

  // 2. RECIPIENT / SENDER SECTION: Two equal columns with green top borders
  const colWidth = (contentWidth - 24) / 2;
  const col1X = margin;
  const col2X = margin + colWidth + 24;

  page.drawLine({ start: { x: col1X, y }, end: { x: col1X + colWidth, y }, thickness: 2, color: brandGreen });
  page.drawLine({ start: { x: col2X, y }, end: { x: col2X + colWidth, y }, thickness: 2, color: brandGreen });
  y -= 12;

  const colY = y;
  // RECIPIENT
  page.drawText("RECIPIENT", { x: col1X, y, size: 9, font: fontBold, color: textMuted });
  y -= 13;
  const custName = est.customer_name || "Valued Customer";
  page.drawText(custName.slice(0, 40), { x: col1X, y, size: 11, font: fontBold, color: textDark });
  y -= 13;
  const custAddress = est.property_address || est.service_address || "";
  if (custAddress) {
    page.drawText(custAddress.slice(0, 45), { x: col1X, y, size: 9.5, font, color: textDark });
    y -= 12;
  }
  if (est.customer_phone) {
    page.drawText(`Phone: ${est.customer_phone}`, { x: col1X, y, size: 9, font, color: textMuted });
    y -= 11;
  }
  if (est.customer_email) {
    page.drawText(`Email: ${String(est.customer_email).slice(0, 40)}`, { x: col1X, y, size: 9, font, color: textMuted });
    y -= 11;
  }

  // SENDER
  let rY = colY;
  page.drawText("SENDER", { x: col2X, y: rY, size: 9, font: fontBold, color: textMuted });
  rY -= 13;
  page.drawText("Space Insulation Inc.", { x: col2X, y: rY, size: 11, font: fontBold, color: textDark });
  rY -= 13;
  page.drawText("GST/HST: 775225360RT0001", { x: col2X, y: rY, size: 9, font, color: textMuted });
  rY -= 12;
  page.drawText("10660 Yonge Street", { x: col2X, y: rY, size: 9.5, font, color: textDark });
  rY -= 12;
  page.drawText("Richmond Hill, Ontario L4C 3C9", { x: col2X, y: rY, size: 9.5, font, color: textDark });
  rY -= 12;
  page.drawText("Phone: 647-704-9021", { x: col2X, y: rY, size: 9, font, color: textMuted });
  rY -= 11;
  page.drawText("Email: space@spaceinsulations.com", { x: col2X, y: rY, size: 9, font, color: textMuted });
  rY -= 11;
  page.drawText("Website: https://spaceinsulation.ca/", { x: col2X, y: rY, size: 9, font, color: textMuted });
  rY -= 11;

  y = Math.min(y, rY) - 16;

  // 3. PRODUCTS / SERVICES TABLE
  const c1W = Math.round(contentWidth * 0.23);
  const c2W = Math.round(contentWidth * 0.57);
  const c3W = Math.round(contentWidth * 0.07);
  const c4W = contentWidth - c1W - c2W - c3W;

  const colProdX = margin;
  const colDescX = colProdX + c1W;
  const colQtyX = colDescX + c2W;
  const colPriceX = colQtyX + c3W;

  page.drawRectangle({ x: margin, y: y - 6, width: contentWidth, height: 20, color: brandGreen });
  page.drawText("PRODUCT SERVICE", { x: colProdX + 6, y: y, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("DESCRIPTION", { x: colDescX + 6, y: y, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("QTY.", { x: colQtyX + 6, y: y, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  const upHeader = "UNIT PRICE";
  const upHeaderW = fontBold.widthOfTextAtSize(upHeader, 8.5);
  page.drawText(upHeader, { x: colPriceX + c4W - upHeaderW - 6, y: y, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });

  y -= 22;

  const rawLineItems = Array.isArray(est.line_items) ? est.line_items : [];
  const lineItems = rawLineItems.length > 0 ? rawLineItems : [
    {
      type: "item",
      name: "Attic Insulation",
      description: est.insulation_type
        ? `Supply and install blown ${String(est.insulation_type).toLowerCase()} insulation to achieve code thermal resistance.`
        : "Supply and install blown attic insulation to achieve code thermal resistance.",
      quantity: Number(est.home_size || 1),
      unit_price: Number(est.insulation_rate || est.total_amount || 0),
    }
  ];

  for (const item of lineItems) {
    if (y < margin + 120) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - 20;
    }

    const isSection = item.type === "section";
    if (isSection) {
      const sTitle = String(item.name || item.description || "Section").slice(0, 50);
      page.drawText(sTitle, { x: margin + 6, y, size: 9.5, font: fontBold, color: textDark });
      y -= 14;
      if (item.description && item.description !== item.name) {
        page.drawText(String(item.description).slice(0, 90), { x: margin + 6, y, size: 8.5, font, color: textMuted });
        y -= 12;
      }
      page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: borderLight });
      y -= 8;
      continue;
    }

    const prodName = String(item.name || item.service || (item.description ? item.description.split(":")[0] : "Service")).slice(0, 22);
    const desc = String(item.description || "").slice(0, 65);
    const qty = String(item.quantity != null ? item.quantity : 1);
    const unitPrice = Number(item.unit_price || 0);

    page.drawText(prodName, { x: colProdX + 6, y, size: 9, font: fontBold, color: textDark });
    page.drawText(desc, { x: colDescX + 6, y, size: 8.5, font, color: textMuted });
    page.drawText(qty, { x: colQtyX + 10, y, size: 8.5, font, color: textDark });

    const pText = `$${unitPrice.toFixed(2)}`;
    const pWidth = font.widthOfTextAtSize(pText, 8.5);
    page.drawText(pText, { x: colPriceX + c4W - pWidth - 6, y, size: 8.5, font, color: textDark });

    y -= 16;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: borderLight });
  }

  y -= 16;
  if (y < margin + 140) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 20;
  }

  // 4. TOTALS (Bottom-Right)
  const totalsW = 200;
  const totalsX = pageWidth - margin - totalsW;
  const subtotal = lineItems.reduce((sum: number, item: any) => {
    if (item.type === "section" || item.is_optional) return sum;
    return sum + (Number(item.quantity || 1) * Number(item.unit_price || 0));
  }, 0);

  let discountAmount = 0;
  if (est.discount_type === "percentage") {
    discountAmount = (subtotal * (Number(est.discount_value) || 0)) / 100;
  } else if (Number(est.discount_value) > 0) {
    discountAmount = Number(est.discount_value);
  }
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const taxRate = typeof est.tax_rate === "number" ? est.tax_rate : 0.13;
  const tax = Number((discountedSubtotal * taxRate).toFixed(2));
  const total = Number((discountedSubtotal + tax).toFixed(2));

  page.drawText("Subtotal", { x: totalsX, y, size: 9, font: fontBold, color: textMuted });
  const subText = `$${subtotal.toFixed(2)}`;
  const subW = font.widthOfTextAtSize(subText, 9);
  page.drawText(subText, { x: pageWidth - margin - subW, y, size: 9, font, color: textDark });
  y -= 14;

  if (discountAmount > 0) {
    page.drawText("Discount", { x: totalsX, y, size: 9, font: fontBold, color: rgb(0.086, 0.639, 0.29) });
    const discText = `-$${discountAmount.toFixed(2)}`;
    const discW = font.widthOfTextAtSize(discText, 9);
    page.drawText(discText, { x: pageWidth - margin - discW, y, size: 9, font, color: rgb(0.086, 0.639, 0.29) });
    y -= 14;
  }

  page.drawText(`HST (${(taxRate * 100).toFixed(0)}%)`, { x: totalsX, y, size: 9, font: fontBold, color: textMuted });
  const taxText = `$${tax.toFixed(2)}`;
  const taxW = font.widthOfTextAtSize(taxText, 9);
  page.drawText(taxText, { x: pageWidth - margin - taxW, y, size: 9, font, color: textDark });
  y -= 16;

  page.drawLine({ start: { x: totalsX, y: y + 6 }, end: { x: pageWidth - margin, y: y + 6 }, thickness: 1.5, color: textDark });

  page.drawText("TOTAL", { x: totalsX, y, size: 12, font: fontBold, color: textDark });
  const totText = `$${total.toFixed(2)}`;
  const totW = fontBold.widthOfTextAtSize(totText, 13);
  page.drawText(totText, { x: pageWidth - margin - totW, y, size: 13, font: fontBold, color: textDark });
  y -= 22;

  // 5. Terms / Notes
  const clientNotes = (est.client_message || est.intro_text || "").trim();
  const termsText = (est.terms || "").trim();
  if (clientNotes || termsText) {
    if (y < margin + 60) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - 20;
    }
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: pageWidth - margin, y: y + 6 }, thickness: 1, color: borderLight });
    if (clientNotes) {
      page.drawText("CLIENT MESSAGE", { x: margin, y, size: 8, font: fontBold, color: textMuted });
      y -= 12;
      page.drawText(clientNotes.slice(0, 100), { x: margin, y, size: 8.5, font, color: textDark });
      y -= 14;
    }
    if (termsText) {
      page.drawText("TERMS & CONDITIONS", { x: margin, y, size: 8, font: fontBold, color: textMuted });
      y -= 12;
      page.drawText(termsText.slice(0, 100), { x: margin, y, size: 8.5, font, color: textMuted });
      y -= 14;
    }
  }

  const bytes = await pdfDoc.save();
  const sanitizedNum = String(est.estimate_number || "EST").replace(/[^a-zA-Z0-9_-]/g, "_");
  return { bytes, filename: `Estimate_${sanitizedNum}.pdf` };
}

async function generateInvoicePdf(inv: any, cust: any, checkoutUrl: string | null): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header Letterhead
  page.drawText("SPACE INSULATION INC.", { x: margin, y, size: 18, font: fontBold, color: rgb(0.08, 0.1, 0.18) });
  page.drawText("INVOICE", { x: pageWidth - margin - 90, y, size: 20, font: fontBold, color: rgb(0.46, 0.77, 0.26) });
  y -= 16;

  page.drawText("Ontario's Trusted Insulation Experts", { x: margin, y, size: 9, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(`# ${inv.invoice_number || ''}`, { x: pageWidth - margin - 90, y, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  y -= 14;

  page.drawText("1070 Major MacKenzie Dr., Richmond Hill, ON L4S 1P3", { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  y -= 12;
  page.drawText("Phone: (647) 704-9021 | Email: info@spaceinsulation.ca | spaceinsulation.ca", { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  y -= 16;

  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });
  y -= 25;

  const boxY = y;
  const col1X = margin;
  const col2X = margin + contentWidth / 2 + 10;

  // Left Col: Client Info
  page.drawText("BILLED TO:", { x: col1X, y, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  y -= 14;
  page.drawText(cust?.full_name || inv.customer_name || "Valued Client", { x: col1X, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 14;
  if (cust?.service_address) {
    page.drawText(String(cust.service_address).slice(0, 45), { x: col1X, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 12;
  }
  if (cust?.email || inv.customer_email) {
    page.drawText(cust?.email || inv.customer_email || "", { x: col1X, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 12;
  }

  // Right Col: Invoice Info
  let rightY = boxY;
  page.drawText("INVOICE DETAILS:", { x: col2X, y: rightY, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  rightY -= 14;
  const invDateStr = inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const dueDateStr = inv.due_date ? new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  page.drawText(`Invoice Date: ${invDateStr}`, { x: col2X, y: rightY, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  rightY -= 12;
  page.drawText(`Due Date: ${dueDateStr}`, { x: col2X, y: rightY, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  rightY -= 12;

  const displayStatus = inv.status === 'Paid' ? 'Paid' : 'Sent';
  page.drawText(`Status: ${displayStatus}`, { x: col2X, y: rightY, size: 9, font: fontBold, color: displayStatus === 'Paid' ? rgb(0.13, 0.5, 0.24) : rgb(0.1, 0.4, 0.8) });

  y = Math.min(y, rightY) - 20;

  // Line items
  page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 20, color: rgb(0.95, 0.96, 0.98) });
  page.drawText("DESCRIPTION", { x: margin + 8, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  page.drawText("QTY", { x: margin + 310, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  page.drawText("UNIT PRICE", { x: margin + 370, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  page.drawText("AMOUNT", { x: margin + 450, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  y -= 22;

  const rawItems = Array.isArray(inv.line_items) ? inv.line_items : [];
  const items = rawItems.length > 0 ? rawItems : [{ description: 'Insulation Services', quantity: 1, unit_price: Number(inv.subtotal || inv.total || 0) }];

  for (const item of items) {
    if (y < margin + 120) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - 20;
    }

    const desc = String(item.description || 'Service Line Item').slice(0, 55);
    const qty = Number(item.quantity || 1);
    const price = Number(item.unit_price || 0);
    const lineTotal = qty * price;

    page.drawText(desc, { x: margin + 8, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(qty.toString(), { x: margin + 310, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`$${price.toFixed(2)}`, { x: margin + 370, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`$${lineTotal.toFixed(2)}`, { x: margin + 450, y, size: 9, font: fontBold, color: rgb(0.15, 0.15, 0.15) });

    y -= 18;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: rgb(0.9, 0.92, 0.95) });
  }

  y -= 15;
  if (y < margin + 140) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 20;
  }

  const totalsX = margin + 330;
  const subtotal = Number(inv.subtotal || 0);
  const tax = Number(inv.tax || 0);
  const total = Number(inv.total || 0);

  page.drawText("Subtotal:", { x: totalsX, y, size: 9.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: margin + 450, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;

  page.drawText("HST:", { x: totalsX, y, size: 9.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(`$${tax.toFixed(2)}`, { x: margin + 450, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 18;

  page.drawText("Invoice Total Due:", { x: totalsX, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`$${total.toFixed(2)}`, { x: margin + 450, y, size: 12, font: fontBold, color: rgb(0.46, 0.77, 0.26) });
  y -= 25;

  if (checkoutUrl && inv.status !== 'Paid') {
    page.drawText("Payment Link:", { x: margin, y, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
    y -= 14;
    page.drawText(checkoutUrl.slice(0, 85), { x: margin, y, size: 8.5, font, color: rgb(0.2, 0.4, 0.8) });
    y -= 20;
  }

  page.drawText("Thank you for choosing Space Insulation Inc.!", { x: margin, y: margin + 10, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });

  const bytes = await pdfDoc.save();
  const sanitizedNum = String(inv.invoice_number || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
  return { bytes, filename: `Invoice_${sanitizedNum}.pdf` };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { documentId, documentType, recipientEmail, personalMessage, pdfBase64, pdfFilename } = await req.json();

    if (!documentId || !documentType || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing documentId, documentType, or recipientEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (documentType !== "estimate" && documentType !== "invoice") {
      return new Response(JSON.stringify({ error: "Invalid documentType. Must be 'estimate' or 'invoice'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Resend API Key
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment secret in Supabase");
    }

    // Get Sender Email Configurations
    const senderEmail = Deno.env.get("RESEND_SENDER_EMAIL") || "invoices@app.spaceinsulation.ca";
    const resendFrom = `Space Insulation <${senderEmail}>`;

    const companyPhone = "647-704-9021";
    const companyEmail = "space@spaceinsulations.com";
    const companyWeb = "spaceinsulation.ca";
    const companyAddress = "10660 Yonge Street, Richmond Hill, Ontario L4C 3C9";

    let emailSubject = "";
    let emailHtml = "";
    let pdfResult: { bytes: Uint8Array; filename: string } | null = null;

    if (documentType === "estimate") {
      // 1. Fetch estimate from database
      const { data: est, error: estErr } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", documentId)
        .maybeSingle();

      if (estErr || !est) {
        throw new Error(estErr?.message || "Estimate not found");
      }

      // Build the approval URL
      const approvalToken = est.approval_token || '';
      const appDomain = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "https://spaceinsulation-app.vercel.app";
      const approvalUrl = approvalToken ? `${appDomain}/approve-estimate/${approvalToken}` : '';

      // Calculations
      const lineItems = Array.isArray(est.line_items) ? est.line_items : [];
      const finalLineItems = lineItems.length > 0 ? lineItems : [
        {
          description: `Insulation Services: ${est.insulation_type} Insulation (${est.home_size} sq ft at $${Number(est.insulation_rate).toFixed(2)}/sq ft)`,
          quantity: 1,
          unit_price: Number(est.home_size) * Number(est.insulation_rate)
        }
      ];

      const subtotal = finalLineItems.reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.unit_price || 0)), 0);
      const tax = Number((subtotal * 0.13).toFixed(2));
      const totalAmount = Number((subtotal + tax).toFixed(2));

      // Check if client provided exact shared template PDF
      if (pdfBase64) {
        try {
          const decodedBytes = base64Decode(pdfBase64);
          const sanitizedNum = String(est.estimate_number || 'EST').replace(/[^a-zA-Z0-9_-]/g, '_');
          pdfResult = {
            bytes: decodedBytes,
            filename: pdfFilename || `estimate_${sanitizedNum}.pdf`,
          };
          console.log(`[send-document-email] Used client-provided shared template PDF for Estimate ${est.estimate_number}. Bytes: ${decodedBytes.length}`);
        } catch (decodeErr) {
          console.warn("[send-document-email] Failed to decode client pdfBase64, falling back to server PDF:", decodeErr);
        }
      }

      // Generate Estimate PDF fallback if needed
      if (!pdfResult) {
        pdfResult = await generateEstimatePdf(est);
      }

      const formattedValidUntil = est.valid_until ? new Date(est.valid_until + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

      emailSubject = `Space Insulation Estimate Proposal: ${est.estimate_number}`;
      emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Insulation Estimate ${est.estimate_number}</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f6f6; color: #333333;">
          <div style="max-width: 560px; margin: 30px auto; background-color: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            
            <!-- Header letterhead -->
            <table style="width: 100%; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; border-collapse: collapse;">
              <tr>
                <td style="vertical-align: middle; text-align: left; width: 56px; padding: 0;">
                  <img src="https://hcoxvaqeomtpcsegadip.supabase.co/storage/v1/object/public/job-media/logo.png" alt="Logo" width="48" height="48" style="width: 48px; height: 48px; object-fit: contain; border-radius: 6px; display: block;" />
                </td>
                <td style="vertical-align: middle; text-align: left; padding: 0 0 0 10px;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.03em; color: #1a1a1a; line-height: 1.1;">SPACE INSULATION</h1>
                  <span style="font-size: 10px; font-weight: bold; color: #718096; letter-spacing: 0.02em; text-transform: uppercase; display: block; margin-top: 2px;">Ontario's Trusted Insulation Experts</span>
                </td>
              </tr>
            </table>

            <div style="font-size: 14px; line-height: 1.6; color: #2d3748;">
              <p style="margin: 0 0 16px 0;">Hi ${est.customer_name || 'Client'},</p>
              
              <p style="margin: 0 0 16px 0;">Thank you for considering Space Insulation for your project.</p>
              
              <p style="margin: 0 0 16px 0;">Please find <strong>Estimate #${est.estimate_number}</strong> attached to this email as a PDF document.</p>

              ${personalMessage ? `
              <div style="margin: 0 0 20px 0; padding: 14px 16px; border-left: 4px solid #84cc16; font-size: 13px; line-height: 1.5; color: #4a5568; background-color: #f8fafc; border-radius: 0 6px 6px 0;">
                <strong>Note from team:</strong> ${personalMessage}
              </div>
              ` : ""}

              <!-- Summary Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                  <strong>Estimated Total:</strong> <span style="font-size: 16px; font-weight: 800; color: #84cc16; margin-left: 4px;">$${totalAmount.toFixed(2)}</span>
                </div>
                ${formattedValidUntil ? `
                <div style="font-size: 13px; color: #64748b;">
                  <strong>Valid Until:</strong> <span style="color: #334155; font-weight: 600; margin-left: 4px;">${formattedValidUntil}</span>
                </div>
                ` : ""}
              </div>

              ${approvalUrl ? `
              <p style="margin: 0 0 16px 0;">You can review and approve your estimate online using the button below:</p>
              
              <div style="margin: 0 0 24px 0; text-align: center;">
                <a href="${approvalUrl}" style="display: inline-block; padding: 12px 28px; background-color: #84cc16; color: #1a1a1a; text-decoration: none; font-weight: bold; font-size: 13px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Review & Approve Estimate</a>
              </div>
              ` : ''}

              <p style="margin: 0 0 24px 0;">If you have any questions or would like to discuss the estimate, simply reply to this email.</p>

              <div style="border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6;">
                <strong style="color: #1e293b;">Best regards,</strong><br />
                Space Insulation Inc.<br />
                Phone: ${companyPhone} | Email: ${companyEmail}<br />
                Website: <a href="https://${companyWeb}" style="color: #84cc16; text-decoration: none; font-weight: bold;">${companyWeb}</a>
              </div>
            </div>

          </div>
        </body>
      </html>
      `;

    } else if (documentType === "invoice") {
      // 2. Fetch invoice from database with customer details
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .select("*, customers(full_name, email, service_address)")
        .eq("id", documentId)
        .maybeSingle();

      if (invErr || !inv) {
        throw new Error(invErr?.message || "Invoice not found");
      }

      const cust = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers;

      let checkoutUrl = inv.stripe_checkout_url || null;
      if (inv.status !== "Paid") {
        try {
          const createSessionRes = await fetch(`${supabaseUrl}/functions/v1/create-payment-session`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ invoiceId: inv.id }),
          });
          if (createSessionRes.ok) {
            const sessionData = await createSessionRes.json();
            checkoutUrl = sessionData.checkoutUrl;
          } else {
            console.error("Failed to generate payment link:", await createSessionRes.text());
          }
        } catch (sessionErr) {
          console.error("Error creating payment session during email dispatch:", sessionErr);
        }
      }

      // Generate Invoice PDF
      pdfResult = await generateInvoicePdf(inv, cust, checkoutUrl);

      const invDueDateStr = inv.due_date ? new Date(inv.due_date + 'T00:00:00').toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : '';

      emailSubject = `Space Insulation Invoice Statement: ${inv.invoice_number}`;
      emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice Statement ${inv.invoice_number}</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f6f6; color: #333333;">
          <div style="max-width: 560px; margin: 30px auto; background-color: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            
            <!-- Header letterhead -->
            <table style="width: 100%; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; border-collapse: collapse;">
              <tr>
                <td style="vertical-align: middle; text-align: left; width: 56px; padding: 0;">
                  <img src="https://hcoxvaqeomtpcsegadip.supabase.co/storage/v1/object/public/job-media/logo.png" alt="Logo" width="48" height="48" style="width: 48px; height: 48px; object-fit: contain; border-radius: 6px; display: block;" />
                </td>
                <td style="vertical-align: middle; text-align: left; padding: 0 0 0 10px;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.03em; color: #1a1a1a; line-height: 1.1;">SPACE INSULATION</h1>
                  <span style="font-size: 10px; font-weight: bold; color: #718096; letter-spacing: 0.02em; text-transform: uppercase; display: block; margin-top: 2px;">Ontario's Trusted Insulation Experts</span>
                </td>
              </tr>
            </table>

            <div style="font-size: 14px; line-height: 1.6; color: #2d3748;">
              <p style="margin: 0 0 16px 0;">Hi ${cust?.full_name || 'Client'},</p>
              
              <p style="margin: 0 0 16px 0;">Thank you for choosing Space Insulation.</p>
              
              <p style="margin: 0 0 16px 0;">Please find <strong>Invoice #${inv.invoice_number}</strong> attached to this email as a PDF document.</p>

              ${personalMessage ? `
              <div style="margin: 0 0 20px 0; padding: 14px 16px; border-left: 4px solid #84cc16; font-size: 13px; line-height: 1.5; color: #4a5568; background-color: #f8fafc; border-radius: 0 6px 6px 0;">
                <strong>Note from team:</strong> ${personalMessage}
              </div>
              ` : ""}

              <!-- Summary Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                  <strong>Invoice Total:</strong> <span style="font-size: 16px; font-weight: 800; color: #84cc16; margin-left: 4px;">$${Number(inv.total).toFixed(2)}</span>
                </div>
                ${invDueDateStr ? `
                <div style="font-size: 13px; color: #64748b;">
                  <strong>Due Date:</strong> <span style="color: #334155; font-weight: 600; margin-left: 4px;">${invDueDateStr}</span>
                </div>
                ` : ""}
              </div>

              ${(inv.status !== "Paid" && checkoutUrl) ? `
              <p style="margin: 0 0 16px 0;">You can pay your invoice securely using the button below:</p>
              
              <div style="margin: 0 0 24px 0; text-align: center;">
                <a href="${checkoutUrl}" style="display: inline-block; padding: 12px 28px; background-color: #84cc16; color: #1a1a1a; text-decoration: none; font-weight: bold; font-size: 13px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Pay Invoice</a>
              </div>
              ` : ''}

              ${inv.status === "Paid" ? `
              <div style="margin: 0 0 24px 0; text-align: center;">
                <div style="display: inline-block; padding: 8px 20px; border: 1px solid #bbf7d0; background-color: #f0fdf4; color: #15803d; font-weight: bold; font-size: 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">Paid In Full</div>
              </div>
              ` : ''}

              <p style="margin: 0 0 24px 0;">If you have any questions about your invoice, simply reply to this email and our team will be happy to help.</p>

              <div style="border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6;">
                <strong style="color: #1e293b;">Best regards,</strong><br />
                Space Insulation Inc.<br />
                Phone: ${companyPhone} | Email: ${companyEmail}<br />
                Website: <a href="https://${companyWeb}" style="color: #84cc16; text-decoration: none; font-weight: bold;">${companyWeb}</a>
              </div>
            </div>

          </div>
        </body>
      </html>
      `;
    }

    // Validate PDF generation
    if (!pdfResult || !pdfResult.bytes || pdfResult.bytes.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Unable to generate PDF attachment." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate PDF magic bytes (%PDF -> 0x25 0x50 0x44 0x46)
    const b = pdfResult.bytes;
    if (b[0] !== 0x25 || b[1] !== 0x50 || b[2] !== 0x44 || b[3] !== 0x46 || !pdfResult.filename.endsWith(".pdf")) {
      return new Response(JSON.stringify({ success: false, error: "Generated PDF attachment is invalid." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attachments = [
      {
        filename: pdfResult.filename,
        content: base64Encode(pdfResult.bytes),
      }
    ];

    console.log(`[send-document-email] PDF attachment created. Document: ${documentType}, Filename: ${pdfResult.filename}, Bytes: ${pdfResult.bytes.length}`);

    // Call Resend send API
    const emailPayload = {
      from: resendFrom,
      to: [recipientEmail],
      subject: emailSubject,
      html: emailHtml,
      attachments
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      throw new Error(`Resend dispatch failure (Status ${resendRes.status}): ${errText}`);
    }

    // Update database status and sent_at timestamp ONLY after Resend succeeds with PDF
    const nowStr = new Date().toISOString();
    if (documentType === "estimate") {
      const { error: updErr } = await supabase
        .from("estimates")
        .update({ status: "Sent", sent_at: nowStr })
        .eq("id", documentId);
      if (updErr) throw updErr;

      if (est?.lead_id) {
        await supabase
          .from("leads")
          .update({
            pipeline_stage: "awaiting_response",
            updated_at: nowStr
          })
          .eq("id", est.lead_id);
      }
    } else if (documentType === "invoice") {
      const { error: updErr } = await supabase
        .from("invoices")
        .update({ status: "Sent", sent_at: nowStr })
        .eq("id", documentId);
      if (updErr) throw updErr;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("send-document-email edge function failure:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
